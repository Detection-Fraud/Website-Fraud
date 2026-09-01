import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

type ReportStatus = "PENDING" | "APPROVED" | "REJECTED";
type CategoryCapability = {
  targetUnit: "KEGIATAN" | "PARTISIPASI_PERSEN";
  evidenceMode: "NONE" | "PHOTO_WITH_AI" | "PHOTO_WITHOUT_AI";
  scoreInputMode: "NONE" | "EXCEL_IMPORT" | "DIRECT_ADMIN";
};

const adminSession = {
  user: { id: "admin-1", name: "Admin", role: "ADMIN" },
};
const directAdminCapability: CategoryCapability = {
  targetUnit: "PARTISIPASI_PERSEN",
  evidenceMode: "PHOTO_WITHOUT_AI",
  scoreInputMode: "DIRECT_ADMIN",
};

let reportStatus: ReportStatus;
let reportNotes: string | null;
let categoryCapability: CategoryCapability;
let transitionCount: number;
let logs: Array<Record<string, unknown>>;

const authMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => adminSession,
);
const updateManyMock = mock.fn<(...args: any[]) => Promise<any>>(async (args: any) => {
  if (
    args.where.id !== "report-1" ||
    reportStatus !== args.where.status
  ) {
    return { count: 0 };
  }

  reportStatus = args.data.status;
  reportNotes = args.data.notes;
  transitionCount += 1;
  return { count: 1 };
});
const logCreateMock = mock.fn<(...args: any[]) => Promise<any>>(async (args: any) => {
  const log = { id: `log-${logs.length + 1}`, ...args.data };
  logs.push(log);
  return log;
});
const findUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({
  id: "report-1",
  status: reportStatus,
  program: { category: categoryCapability },
}));
const transactionMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (callback: any) =>
    callback({
      activityReport: {
        updateMany: updateManyMock,
        findUnique: findUniqueMock,
      },
      activityLog: { create: logCreateMock },
    }),
);

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/prisma", {
  namedExports: { prisma: { $transaction: transactionMock } },
});

let PATCH: (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

before(async () => {
  ({ PATCH } = await import("./route"));
});

beforeEach(() => {
  authMock.mock.resetCalls();
  updateManyMock.mock.resetCalls();
  logCreateMock.mock.resetCalls();
  findUniqueMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
  authMock.mock.mockImplementation(async () => adminSession);
  reportStatus = "PENDING";
  reportNotes = null;
  categoryCapability = directAdminCapability;
  transitionCount = 0;
  logs = [];
});

function request(body: unknown) {
  return new NextRequest("http://localhost/api/reports/report-1/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function run(body: unknown) {
  return PATCH(request(body), {
    params: Promise.resolve({ id: "report-1" }),
  });
}

async function responseBody(response: Response) {
  return response.json() as Promise<{
    status: number;
    error: boolean;
    message: string;
    data: any;
  }>;
}

describe("PATCH /api/reports/[id]/status", () => {
  it("mewajibkan capability Admin dan body review yang valid", async () => {
    authMock.mock.mockImplementationOnce(async () => ({
      user: { id: "pic-1", name: "PIC", role: "PIC" },
    }));
    const forbidden = await run({ status: "APPROVED" });
    assert.equal(forbidden.status, 403);

    const invalidStatus = await run({ status: "PENDING" });
    const invalidNote = await run({ status: "REJECTED", notes: "pendek" });
    assert.equal(invalidStatus.status, 400);
    assert.equal(invalidNote.status, 400);
    assert.equal(transactionMock.mock.callCount(), 0);
  });

  it("menghasilkan exact nextAction hanya untuk capability direct-admin", async () => {
    const response = await run({ status: "APPROVED" });
    const body = await responseBody(response);

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, {
      reportId: "report-1",
      status: "APPROVED",
      nextAction: {
        type: "ENTER_PARTICIPATION_SCORE",
        reportId: "report-1",
      },
    });
    assert.deepEqual((updateManyMock.mock.calls as any)[0].arguments[0], {
      where: { id: "report-1", status: "PENDING" },
      data: { status: "APPROVED", notes: null },
    });
    assert.equal(transitionCount, 1);
    assert.equal(logs.length, 1);
  });

  it("tidak mengirim nextAction untuk capability non-direct-admin", async () => {
    const capabilities: CategoryCapability[] = [
      {
        targetUnit: "KEGIATAN",
        evidenceMode: "PHOTO_WITH_AI",
        scoreInputMode: "NONE",
      },
      {
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "NONE",
        scoreInputMode: "EXCEL_IMPORT",
      },
      {
        targetUnit: "PARTISIPASI_PERSEN",
        evidenceMode: "NONE",
        scoreInputMode: "DIRECT_ADMIN",
      },
    ];

    for (const capability of capabilities) {
      reportStatus = "PENDING";
      categoryCapability = capability;
      const response = await run({ status: "APPROVED" });
      const body = await responseBody(response);
      assert.equal(response.status, 200);
      assert.equal(body.data.nextAction, null);
    }
  });

  it("menyimpan rejection note pada satu transisi dan satu log", async () => {
    const notes = "Bukti kegiatan belum menunjukkan peserta dengan jelas";
    const response = await run({ status: "REJECTED", notes });
    const body = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(reportStatus, "REJECTED");
    assert.equal(reportNotes, notes);
    assert.equal(transitionCount, 1);
    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0], {
      id: "log-1",
      reportId: "report-1",
      action: "REJECTED",
      notes,
      actorId: "admin-1",
      actorName: "Admin",
      actorRole: "ADMIN",
    });
    assert.equal(body.data.nextAction, null);
  });

  it("memberi satu sukses dan satu 409 untuk approval/rejection paralel", async () => {
    const responses = await Promise.all([
      run({ status: "APPROVED" }),
      run({
        status: "REJECTED",
        notes: "Bukti kegiatan belum memenuhi ketentuan yang berlaku",
      }),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 409],
    );
    assert.equal(transitionCount, 1);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, reportStatus);
    const conflict = responses.find((response) => response.status === 409);
    assert.ok(conflict);
    const conflictBody = await responseBody(conflict);
    assert.equal(conflictBody.error, true);
    assert.equal(conflictBody.status, 409);
    assert.equal(conflictBody.data, null);
  });

  it("menjaga APPROVED tetap final pada transisi berikutnya", async () => {
    const approved = await run({ status: "APPROVED" });
    const repeated = await run({
      status: "REJECTED",
      notes: "Percobaan mengubah approval final harus selalu ditolak",
    });

    assert.equal(approved.status, 200);
    assert.equal(repeated.status, 409);
    assert.equal(reportStatus, "APPROVED");
    assert.equal(transitionCount, 1);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "APPROVED");
  });
});
