import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";

const authMock = mock.fn<(...args: any[]) => Promise<any>>(async () => null);
const programWheres: Record<string, unknown>[] = [];
const groupByWheres: Record<string, unknown>[] = [];
let includeTogaRecords = false;
const programFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (args: { where: Record<string, unknown>; select: Record<string, unknown> }) => {
    programWheres.push(args.where);
    if (!("id" in args.select)) {
      return [
        {
          isActive: true,
          tw: 1,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-03-31"),
          uploadDeadline: new Date("2099-03-31"),
        },
      ];
    }
    return [
      {
        id: "kegiatan-program",
        name: "Kegiatan",
        description: null,
        bannerUrl: null,
        frequency: 1,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
        uploadDeadline: new Date("2099-03-31"),
        isActive: true,
        category: {
          id: "kegiatan-category",
          name: "Kegiatan",
          color: null,
          bannerUrl: null,
          targetUnit: "KEGIATAN",
        },
      },
    ];
  },
);
const programFindFirstMock = mock.fn<(...args: any[]) => Promise<any>>(async () => null);
const activityFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () =>
    includeTogaRecords
      ? [
          {
            id: "toga-report",
            status: "APPROVED",
            tanggalKegiatan: new Date("2026-02-01"),
            createdAt: new Date("2026-02-02"),
            program: { name: "TOGA" },
          },
        ]
      : [],
);
const groupByMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (args: { where: Record<string, unknown> }) => {
    groupByWheres.push(args.where);
    return groupByWheres.length % 2 === 1
      ? [{ status: "APPROVED", _count: { id: 2 } }]
      : [{ createdById: "pic-1", _count: { id: 2 } }];
  },
);
const userFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => [{ id: "pic-1", name: "PIC Satu", unit: { name: "Unit Satu" } }],
);

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      programBudaya: {
        findMany: programFindManyMock,
        findFirst: programFindFirstMock,
      },
      activityReport: {
        findMany: activityFindManyMock,
        groupBy: groupByMock,
      },
      user: { findMany: userFindManyMock },
    },
  },
});

let GET: (request: NextRequest) => Promise<Response>;
before(async () => {
  ({ GET } = await import("./route"));
});
beforeEach(() => {
  programWheres.length = 0;
  groupByWheres.length = 0;
  includeTogaRecords = false;
  authMock.mock.resetCalls();
  programFindManyMock.mock.resetCalls();
  programFindFirstMock.mock.resetCalls();
  activityFindManyMock.mock.resetCalls();
  groupByMock.mock.resetCalls();
  userFindManyMock.mock.resetCalls();
});
function request() {
  return new NextRequest("http://localhost/api/pic/dashboard?year=2026&tw=1");
}
async function body(response: Response) {
  return response.json() as Promise<{
    status?: number;
    error: boolean;
    data: Record<string, unknown> | null;
  }>;
}

test("dashboard hanya memilih KEGIATAN, mempertahankan multiple report, cap 120%, dan merahasiakan score", async () => {
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", role: "PIC", unitId: "unit-1" },
  }));
  const response = await GET(request());
  const result = await body(response);
  assert.equal(response.status, 200);
  assert.deepEqual(result.data?.stats, {
    target: 1,
    approved: 2,
    pending: 0,
    rejected: 0,
    compliance: 120,
  });
  assert.deepEqual(result.data?.rank, { position: 1, total: 1 });
  assert.equal(programWheres.length, 2);
  assert.deepEqual(programWheres[0].category, { targetUnit: "KEGIATAN" });
  assert.deepEqual(programWheres[1].category, { targetUnit: "KEGIATAN" });
  assert.deepEqual(groupByWheres[0].programId, { in: ["kegiatan-program"] });
  assert.deepEqual(groupByWheres[1].programId, { in: ["kegiatan-program"] });
  for (const key of [
    "percentage",
    "assessedBy",
    "assessedAt",
    "changeReason",
    "scoreHistories",
  ]) {
    assert.equal(key in result.data!, false);
  }
});

test("menambah record TOGA tidak mengubah hasil activity", async () => {
  authMock.mock.mockImplementation(async () => ({
    user: { id: "pic-1", role: "PIC", unitId: "unit-1" },
  }));
  const beforeResponse = await GET(request());
  const beforeBody = await body(beforeResponse);
  includeTogaRecords = true;
  const afterResponse = await GET(request());
  const afterBody = await body(afterResponse);
  assert.deepEqual(afterBody.data?.stats, beforeBody.data?.stats);
  assert.deepEqual(afterBody.data?.rank, beforeBody.data?.rank);
  assert.deepEqual(afterBody.data?.leaderboard, beforeBody.data?.leaderboard);
  assert.deepEqual(
    afterBody.data?.periodPrograms,
    beforeBody.data?.periodPrograms,
  );
});

for (const role of ["ADMIN", "VIEWER"] as const) {
  test(`${role} menerima 403`, async () => {
    authMock.mock.mockImplementationOnce(async () => ({
      user: { id: `${role.toLowerCase()}-1`, role },
    }));
    const response = await GET(request());
    const result = await body(response);
    assert.equal(response.status, 403);
    assert.equal(result.error, true);
    assert.equal(result.status, 403);
    assert.equal(result.data, null);
  });
}

test("request tanpa session menerima 401", async () => {
  authMock.mock.mockImplementationOnce(async () => null);
  const response = await GET(request());
  const result = await body(response);
  assert.equal(response.status, 401);
  assert.equal(result.error, true);
  assert.equal(result.status, 401);
  assert.equal(result.data, null);
});

test("scope kosong mengembalikan payload nol tanpa aggregate", async () => {
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", role: "PIC", unitId: "unit-kosong" },
  }));
  programFindManyMock.mock.mockImplementationOnce(async (args: any) => {
    programWheres.push(args.where);
    return [];
  });
  const response = await GET(request());
  const result = await body(response);
  assert.equal(response.status, 200);
  assert.equal(result.data?.selectedPeriod, null);
  assert.deepEqual(result.data?.stats, {
    target: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    compliance: 0,
  });
  assert.equal(groupByMock.mock.callCount(), 0);
});
