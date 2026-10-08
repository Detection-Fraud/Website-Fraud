import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

class TestApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

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
let reportLastSubmittedAt: Date;
let categoryCapability: CategoryCapability;
let transitionCount: number;
let logs: Array<Record<string, unknown>>;
let scores: Array<Record<string, unknown>>;
let histories: Array<Record<string, unknown>>;
let assessmentError: unknown;
let logError: unknown;

const authMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => adminSession,
);
const requireAdminMock = mock.fn<(...args: any[]) => Promise<any>>(async () => {
  const session = await authMock();

  if (session?.user?.role !== "ADMIN") {
    throw new TestApiError("Hanya Admin yang dapat mengakses", 403);
  }

  return session;
});
const updateManyMock = mock.fn<(...args: any[]) => Promise<any>>(async (args: any) => {
  if (
    args.where.id !== "report-1" ||
    reportStatus !== args.where.status
  ) {
    return { count: 0 };
  }

  reportStatus = args.data.status;
  reportNotes = args.data.notes;
  if ("lastSubmittedAt" in args.data) {
    reportLastSubmittedAt = args.data.lastSubmittedAt;
  }
  transitionCount += 1;
  return { count: 1 };
});
const logCreateMock = mock.fn<(...args: any[]) => Promise<any>>(async (args: any) => {
  if (logError) throw logError;
  const log = { id: `log-${logs.length + 1}`, ...args.data };
  logs.push(log);
  return log;
});
const findUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({
  id: "report-1",
  status: reportStatus,
  program: { category: categoryCapability },
}));
const assessInTransactionMock = mock.fn(async (input: any, tx: any) => {
  if (assessmentError) throw assessmentError;
  const score = { reportId: input.reportId, percentage: input.percentage };
  const history = { reportId: input.reportId, percentage: input.percentage };
  tx.scores.push(score);
  tx.histories.push(history);
  return { status: "CREATED", participationDataId: "participation-1", percentage: input.percentage };
});
const transactionMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (callback: any) => {
    let didTransition = false;
    const previous = {
      reportStatus,
      reportNotes,
      transitionCount,
      logs: [...logs],
      scores: [...scores],
      histories: [...histories],
    };
    const tx = {
      activityReport: {
        updateMany: async (args: any) => {
          const result = await updateManyMock(args);
          didTransition = didTransition || result.count === 1;
          return result;
        },
        findUnique: findUniqueMock,
      },
      activityLog: { create: logCreateMock },
      scores,
      histories,
    };
    try {
      return await callback(tx);
    } catch (error) {
      if (didTransition) {
        reportStatus = previous.reportStatus;
        reportNotes = previous.reportNotes;
        transitionCount = previous.transitionCount;
        logs = previous.logs;
        scores = previous.scores;
        histories = previous.histories;
      }
      throw error;
    }
  },
);

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/api/auth-guard", {
  namedExports: {
    ApiError: TestApiError,
    requireAdmin: requireAdminMock,
    handleApiError: (error: unknown) =>
      Response.json(
        {
          success: false,
          error: true,
          status: error instanceof TestApiError ? error.status : 500,
          message:
            error instanceof TestApiError ? error.message : "internal",
          data: null,
        },
        { status: error instanceof TestApiError ? error.status : 500 },
      ),
  },
});
mock.module("@/lib/prisma", {
  namedExports: { prisma: { $transaction: transactionMock } },
});
mock.module("@/lib/program-capabilities", {
  namedExports: { usesDirectAdminScore: (capability: CategoryCapability) =>
    capability.targetUnit === "PARTISIPASI_PERSEN" &&
    capability.evidenceMode === "PHOTO_WITHOUT_AI" &&
    capability.scoreInputMode === "DIRECT_ADMIN" },
});
mock.module("@/lib/participation-assessment", {
  namedExports: { assessParticipationScoreInTransaction: assessInTransactionMock },
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
  requireAdminMock.mock.resetCalls();
  updateManyMock.mock.resetCalls();
  logCreateMock.mock.resetCalls();
  findUniqueMock.mock.resetCalls();
  assessInTransactionMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
  authMock.mock.mockImplementation(async () => adminSession);
  reportStatus = "PENDING";
  reportNotes = null;
  reportLastSubmittedAt = new Date("2026-06-01T12:00:00.000Z");
  categoryCapability = directAdminCapability;
  transitionCount = 0;
  logs = [];
  scores = [];
  histories = [];
  assessmentError = undefined;
  logError = undefined;
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

  it("mewajibkan nilai untuk capability direct-admin dan membuat score/status/log dalam satu transaksi", async () => {
    const missing = await run({ status: "APPROVED" });
    assert.equal(missing.status, 400);
    assert.equal(reportStatus, "PENDING");
    assert.equal(transitionCount, 0);
    assert.equal(logs.length, 0);

    const originalLastSubmittedAt = reportLastSubmittedAt;
    const response = await run({ status: "APPROVED", percentage: 0 });
    const body = await responseBody(response);

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, {
      reportId: "report-1",
      status: "APPROVED",
      nextAction: null,
    });
    assert.deepEqual((updateManyMock.mock.calls as any)[0].arguments[0], {
      where: { id: "report-1", status: "PENDING" },
      data: { status: "APPROVED", notes: null },
    });
    assert.equal(reportLastSubmittedAt, originalLastSubmittedAt);
    assert.equal(transitionCount, 1);
    assert.equal(logs.length, 1);
    assert.deepEqual(scores, [{ reportId: "report-1", percentage: 0 }]);
    assert.deepEqual(histories, [{ reportId: "report-1", percentage: 0 }]);
    assert.equal(assessInTransactionMock.mock.callCount(), 1);
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
      assert.equal(assessInTransactionMock.mock.callCount(), 0);
    }
  });

  it("menolak nilai di luar rentang, pecahan, dan tipe selain number sebelum transaksi", async () => {
    for (const percentage of [-1, 101, 1.5, "50", null]) {
      const response = await run({ status: "APPROVED", percentage });
      assert.equal(response.status, 400, `percentage=${String(percentage)}`);
      assert.equal(reportStatus, "PENDING");
    }
    assert.equal(transactionMock.mock.callCount(), 0);
    assert.equal(assessInTransactionMock.mock.callCount(), 0);
  });

  it("menerima nilai batas 100", async () => {
    const response = await run({ status: "APPROVED", percentage: 100 });

    assert.equal(response.status, 200);
    assert.equal(reportStatus, "APPROVED");
    assert.deepEqual(scores, [{ reportId: "report-1", percentage: 100 }]);
    assert.equal(logs.length, 1);
  });

  it("mengembalikan status, nilai, log, dan history jika penilaian gagal", async () => {
    assessmentError = new TestApiError("Konflik sumber kanonik", 409);
    const response = await run({ status: "APPROVED", percentage: 50 });

    assert.equal(response.status, 409);
    assert.equal(reportStatus, "PENDING");
    assert.equal(transitionCount, 0);
    assert.deepEqual(logs, []);
    assert.deepEqual(scores, []);
    assert.deepEqual(histories, []);
  });

  it("mengembalikan status, nilai, dan history jika activity log gagal", async () => {
    logError = new Error("log write failed");
    const response = await run({ status: "APPROVED", percentage: 50 });

    assert.equal(response.status, 500);
    assert.equal(reportStatus, "PENDING");
    assert.equal(transitionCount, 0);
    assert.deepEqual(logs, []);
    assert.deepEqual(scores, []);
    assert.deepEqual(histories, []);
  });

  it("menyimpan rejection note pada satu transisi dan satu log", async () => {
    const notes = "Bukti kegiatan belum menunjukkan peserta dengan jelas";
    const originalLastSubmittedAt = reportLastSubmittedAt;
    const response = await run({ status: "REJECTED", notes });
    const body = await responseBody(response);

    assert.equal(response.status, 200);
    assert.equal(reportStatus, "REJECTED");
    assert.equal(reportNotes, notes);
    assert.deepEqual((updateManyMock.mock.calls as any)[0].arguments[0], {
      where: { id: "report-1", status: "PENDING" },
      data: { status: "REJECTED", notes },
    });
    assert.equal(reportLastSubmittedAt, originalLastSubmittedAt);
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
      run({ status: "APPROVED", percentage: 50 }),
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

  it("memberi satu sukses dan satu 409 untuk dua approval direct-admin paralel tanpa menggandakan score atau audit", async () => {
    const responses = await Promise.all([
      run({ status: "APPROVED", percentage: 40 }),
      run({ status: "APPROVED", percentage: 80 }),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status).sort(),
      [200, 409],
    );
    assert.equal(reportStatus, "APPROVED");
    assert.equal(transitionCount, 1);
    assert.equal(assessInTransactionMock.mock.callCount(), 1);
    assert.equal(scores.length, 1);
    assert.equal(histories.length, 1);
    assert.equal(logs.length, 1);
    assert.equal(scores[0].percentage, histories[0].percentage);
    assert.equal(logs[0].action, "APPROVED");
  });

  it("menjaga APPROVED tetap final pada transisi berikutnya", async () => {
    const approved = await run({ status: "APPROVED", percentage: 50 });
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
