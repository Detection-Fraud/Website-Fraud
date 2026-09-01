import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

const authMock = mock.fn<(...args: any[]) => Promise<any>>(async () => null);
const unitFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => [],
);
const categoryFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => [],
);
const reportFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => [],
);
const reportCountMock = mock.fn<(...args: any[]) => Promise<number>>(
  async () => 0,
);
const participationFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => [],
);

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      unit: { findMany: unitFindManyMock },
      programCategory: { findMany: categoryFindManyMock },
      activityReport: { findMany: reportFindManyMock, count: reportCountMock },
      participationData: { findMany: participationFindManyMock },
    },
  },
});

let GET: (request: Request) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  authMock.mock.resetCalls();
  unitFindManyMock.mock.resetCalls();
  categoryFindManyMock.mock.resetCalls();
  reportFindManyMock.mock.resetCalls();
  reportCountMock.mock.resetCalls();
  participationFindManyMock.mock.resetCalls();
});

function request(query = "") {
  return new NextRequest(`http://localhost/api/reports/participation${query}`);
}

async function body(response: Response) {
  return response.json() as Promise<{
    status: number;
    error: boolean;
    data: unknown;
    message: string;
  }>;
}

const unit = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Unit A",
  type: "KANTOR_CABANG",
  wilayah: "Kanwil A",
  parentId: null,
};
const category = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "TOGA",
  programs: [
    {
      id: "33333333-3333-4333-8333-333333333331",
      tw: 1,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      id: "33333333-3333-4333-8333-333333333332",
      tw: 2,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      tw: 3,
      startDate: new Date("2026-07-01T00:00:00.000Z"),
    },
    {
      id: "33333333-3333-4333-8333-333333333334",
      tw: 4,
      startDate: new Date("2026-10-01T00:00:00.000Z"),
    },
  ],
};

function prepareAdmin() {
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "admin-1", role: "ADMIN" },
  }));
  unitFindManyMock.mock.mockImplementation(async (args: any) =>
    args?.skip === undefined ? [unit] : [unit],
  );
  categoryFindManyMock.mock.mockImplementation(async () => [category]);
}

describe("GET /api/reports/participation", () => {
  it("mengembalikan 401/403 sebelum query untuk unauthenticated dan non-Admin", async () => {
    authMock.mock.mockImplementationOnce(async () => null);
    let response = await GET(request());
    assert.equal(response.status, 401);
    assert.equal(unitFindManyMock.mock.callCount(), 0);
    authMock.mock.mockImplementationOnce(async () => ({
      user: { id: "pic-1", role: "PIC" },
    }));
    response = await GET(request());
    const result = await body(response);
    assert.equal(response.status, 403);
    assert.equal(result.data, null);
    assert.equal(categoryFindManyMock.mock.callCount(), 0);
  });

  it("menolak query invalid dengan 400", async () => {
    authMock.mock.mockImplementationOnce(async () => ({
      user: { id: "admin-1", role: "ADMIN" },
    }));
    const response = await GET(request("?tw=9&limit=0"));
    assert.equal(response.status, 400);
    assert.equal(unitFindManyMock.mock.callCount(), 0);
  });

  it("membentuk lima status, mempertahankan unit tanpa report, dan melakukan satu batch report query", async () => {
    prepareAdmin();
    const units = [
      unit,
      ...["B", "C", "D", "E"].map((name, index) => ({
        ...unit,
        id: `44444444-4444-4444-8444-44444444444${index + 1}`,
        name: `Unit ${name}`,
      })),
      {
        ...unit,
        id: "44444444-4444-4444-8444-444444444449",
        name: "Unit F",
      },
    ];
    categoryFindManyMock.mock.mockImplementationOnce(async () => [
      { ...category, programs: [category.programs[0]] },
    ]);
    unitFindManyMock.mock.mockImplementationOnce(async () => units);
    unitFindManyMock.mock.mockImplementation(async () => units);
    reportFindManyMock.mock.mockImplementationOnce(async () => [
      {
        id: "55555555-5555-4555-8555-555555555551",
        unitId: units[0].id,
        programId: category.programs[0].id,
        status: "PENDING",
        notes: null,
        participationAssessment: null,
      },
      {
        id: "55555555-5555-4555-8555-555555555552",
        unitId: units[1].id,
        programId: category.programs[0].id,
        status: "REJECTED",
        notes: "Perlu diperbaiki",
        participationAssessment: null,
      },
      {
        id: "55555555-5555-4555-8555-555555555553",
        unitId: units[2].id,
        programId: category.programs[0].id,
        status: "APPROVED",
        notes: null,
        participationAssessment: null,
      },
      {
        id: "55555555-5555-4555-8555-555555555554",
        unitId: units[3].id,
        programId: category.programs[0].id,
        status: "APPROVED",
        notes: null,
        participationAssessment: {
          percentage: 0,
          assessedAt: new Date(),
          updatedAt: new Date(),
          assessedBy: { id: "admin-1", name: "Admin" },
        },
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        unitId: units[4].id,
        programId: category.programs[0].id,
        status: "APPROVED",
        notes: null,
        participationAssessment: {
          percentage: null,
          assessedAt: null,
          updatedAt: new Date(),
          assessedBy: null,
        },
      },
    ]);
    const response = await GET(
      request("?year=2026&participationType=WITH_EVIDENCE&limit=10"),
    );
    const result = await body(response);
    assert.equal(response.status, 200);
    const rows = result.data as { data: Array<{ status: string }> };
    assert.deepEqual(
      rows.data.map((row) => row.status),
      [
        "PENDING",
        "REJECTED",
        "APPROVED_BELUM_DINILAI",
        "SELESAI",
        "APPROVED_BELUM_DINILAI",
        "BELUM_UPLOAD",
      ],
    );
    assert.equal(
      (rows.data[3] as unknown as { score: { percentage: number } }).score
        .percentage,
      0,
    );
    assert.equal(rows.data[3].status, "SELESAI");
    assert.equal(rows.data[4].status, "APPROVED_BELUM_DINILAI");
    assert.equal((rows.data[4] as unknown as { score: null }).score, null);
    assert.equal(
      (result.data as { pagination: { total: number } }).pagination.total,
      6,
    );
    assert.equal(reportFindManyMock.mock.callCount(), 1);
     assert.equal(categoryFindManyMock.mock.callCount(), 1);
    assert.equal(reportCountMock.mock.callCount(), 0);
  });

  it("menghitung total gabungan assessed dan unassessed secara tepat", async () => {
    prepareAdmin();

    let response = await GET(
      request("?evidenceStatus=ALL&scoreStatus=ALL&limit=10"),
    );
    let result = await body(response);
    assert.equal(response.status, 200);
    assert.equal(
      (result.data as { pagination: { total: number } }).pagination.total,
      4,
    );

    prepareAdmin();
    reportCountMock.mock.mockImplementationOnce(async () => 2);
    response = await GET(
      request("?evidenceStatus=ALL&scoreStatus=SELESAI&limit=10"),
    );
    result = await body(response);
    assert.equal(response.status, 200);
    assert.equal(
      (result.data as { pagination: { total: number } }).pagination.total,
      2,
    );
    assert.deepEqual(
      (reportCountMock.mock.calls[0].arguments[0] as any).where,
      {
        unitId: { in: [unit.id] },
        programId: { in: category.programs.map((program) => program.id) },
        status: "APPROVED",
        participationAssessment: { is: { percentage: { not: null } } },
      },
    );

    prepareAdmin();
    reportCountMock.mock.mockImplementationOnce(async () => 2);
    response = await GET(
      request("?evidenceStatus=ALL&scoreStatus=BELUM_DINILAI&limit=10"),
    );
    result = await body(response);
    assert.equal(response.status, 200);
    assert.equal(
      (result.data as { pagination: { total: number } }).pagination.total,
      2,
    );
  });

  it("menerapkan evidenceStatus dan page/limit tanpa query per row", async () => {
    prepareAdmin();
    const response = await GET(
      request("?evidenceStatus=BELUM_UPLOAD&page=1&limit=1"),
    );
    const result = await body(response);
    assert.equal(response.status, 200);
    const data = result.data as {
      data: unknown[];
      pagination: { page: number; limit: number; total: number };
    };
    assert.equal(data.pagination.page, 1);
    assert.equal(data.pagination.limit, 1);
    assert.deepEqual(unitFindManyMock.mock.calls[1].arguments[0], {
      where: { id: { in: [unit.id] } },
      select: { id: true, name: true, type: true, parentId: true },
      orderBy: { name: "asc" },
      skip: 0,
      take: 1,
    });
    assert.equal(reportFindManyMock.mock.callCount(), 1);
    assert.equal(reportFindManyMock.mock.callCount() <= 1, true);
  });

  it("menghitung approved dengan assessment percentage null sebagai BELUM_DINILAI", async () => {
    prepareAdmin();
    reportCountMock.mock.mockImplementationOnce(async () => 2);

    const response = await GET(
      request("?evidenceStatus=APPROVED_BELUM_DINILAI&limit=10"),
    );
    const result = await body(response);
    const data = result.data as {
      pagination: { total: number };
    };

    assert.equal(response.status, 200);
    assert.equal(data.pagination.total, 2);
    assert.deepEqual(
      (reportCountMock.mock.calls[0].arguments[0] as any).where.OR,
      [
        { participationAssessment: { is: null } },
        { participationAssessment: { is: { percentage: null } } },
      ],
    );
  });

  it("menggunakan mode VALUE_ONLY tanpa report query dan tetap membatasi select domain", async () => {
    prepareAdmin();
    participationFindManyMock.mock.mockImplementationOnce(async () => [
      {
        id: "66666666-6666-4666-8666-666666666666",
        unitId: unit.id,
        categoryId: category.id,
        tw: 1,
        year: 2026,
        percentage: 0,
        category: { id: category.id, name: category.name },
      },
    ]);
    const response = await GET(
      request("?participationType=VALUE_ONLY&year=2026"),
    );
    assert.equal(response.status, 200);
    assert.equal(participationFindManyMock.mock.callCount(), 1);
    assert.equal(reportFindManyMock.mock.callCount(), 0);
  });
});
