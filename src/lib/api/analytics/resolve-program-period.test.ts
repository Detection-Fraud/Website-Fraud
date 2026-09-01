import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { mock, test } from "node:test";

const findManyMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (args: { where: Record<string, unknown> }) => {
    assert.deepEqual(args.where.category, { targetUnit: "KEGIATAN" });
    if (args.where.id === "toga-program") return [];
    const yearBounds = args.where.startDate as { gte: Date; lt: Date };
    const year = yearBounds.gte.getUTCFullYear();
    return year === 2026
      ? [
          {
            id: "activity-program",
            name: "Kegiatan",
            frequency: 3,
            tw: 1,
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: new Date("2026-03-31T00:00:00.000Z"),
          },
        ]
      : [];
  },
);
const authMock = mock.fn<(...args: any[]) => Promise<any>>(async () => ({
  user: { id: "admin-1", role: "ADMIN", unitId: null },
}));
const resolveScopeMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => ({ whereClause: {} }),
);
const summaryMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (scope: { whereClause: Record<string, unknown>; programTarget: number }) => {
    assert.deepEqual(scope.whereClause.programId, { in: ["activity-program"] });
    assert.equal(scope.programTarget, 3);
    return { totalKegiatan: 1 };
  },
);
const trendMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (
    current: Record<string, unknown>,
    previous: Record<string, unknown>,
  ) => {
    assert.deepEqual(current.programId, { in: ["activity-program"] });
    assert.deepEqual(previous.programId, { in: [] });
    return {
      kegiatanPerBulan: [],
      kegiatanPerTriwulan: [],
      kegiatanPerSemester: [],
    };
  },
);
const distributionMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (where: Record<string, unknown>) => {
    assert.deepEqual(where.programId, { in: ["activity-program"] });
    return [];
  },
);
const rankingMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (params: {
    whereClause: Record<string, unknown>;
    programTarget: number;
  }) => {
    assert.deepEqual(params.whereClause.programId, {
      in: ["activity-program"],
    });
    assert.equal(params.programTarget, 3);
    return { rankingWilayah: [], rankingTotal: 0, rankingTotalPages: 1 };
  },
);
const topUnitsMock = mock.fn<(...args: any[]) => Promise<any>>(
  async ({ whereClause }: { whereClause: Record<string, unknown> }) => {
    assert.deepEqual(whereClause.programId, { in: ["activity-program"] });
    return [];
  },
);
const ccMock = mock.fn<(...args: any[]) => Promise<any>>(
  async (params: {
    whereClause: Record<string, unknown>;
    programTarget: number;
  }) => {
    assert.deepEqual(params.whereClause.programId, {
      in: ["activity-program"],
    });
    assert.equal(params.programTarget, 3);
    return { rankingCC: [], rankingCCTotal: 0, rankingCCTotalPages: 0 };
  },
);

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      programBudaya: { findMany: findManyMock },
      unit: { findMany: mock.fn(async () => []) },
    },
  },
});
mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/api/auth-guard", {
  namedExports: {
    requireAuth: authMock,
    handleApiError: (error: unknown) =>
      Response.json({ error: true, message: String(error) }, { status: 500 }),
  },
});
mock.module("@/lib/api/unit-scope", {
  namedExports: { resolveScope: resolveScopeMock },
});
mock.module("@/lib/response", {
  namedExports: {
    successResponse: (data: unknown, message: string) => ({
      success: true,
      error: false,
      data,
      message,
    }),
    errorResponse: (message: string, status: number) => ({
      success: false,
      error: true,
      status,
      message,
    }),
  },
});
mock.module("@/lib/api/analytics/get-summary-cards", {
  namedExports: { getSummaryCards: summaryMock },
});
mock.module("@/lib/api/analytics/get-monthly-trend", {
  namedExports: { getMonthlyTrend: trendMock },
});
mock.module("@/lib/api/analytics/get-distribusi", {
  namedExports: { getDistribusi: distributionMock },
});
mock.module("@/lib/api/analytics/get-ranking", {
  namedExports: { getRanking: rankingMock },
});
mock.module("@/lib/api/analytics/get-top-units", {
  namedExports: { getTopUnits: topUnitsMock },
});
mock.module("@/lib/api/analytics/get-ranking-cc", {
  namedExports: { getRankingCC: ccMock },
});

let resolveProgramPeriod: typeof import("./resolve-program-period").resolveProgramPeriod;
let GET: typeof import("@/app/api/analytics/dashboard/route").GET;
test.before(async () => {
  ({ resolveProgramPeriod } = await import("./resolve-program-period"));
  ({ GET } = await import("@/app/api/analytics/dashboard/route"));
});

test("TOGA tidak mengubah IDs, target, dan scope seluruh consumer analytics", {
  concurrency: false,
}, async () => {
  const result = await resolveProgramPeriod({
    year: 2026,
    period: "TW1",
    programId: "toga-program",
  });
  assert.deepEqual(result.programIds, []);
  assert.equal(result.target, 0);
  const response = await GET(
    new NextRequest(
      "http://localhost/api/analytics/dashboard?year=2026&periode=ALL",
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(summaryMock.mock.callCount(), 1);
  assert.equal(trendMock.mock.callCount(), 1);
  assert.equal(distributionMock.mock.callCount(), 1);
  assert.equal(rankingMock.mock.callCount(), 1);
  assert.equal(topUnitsMock.mock.callCount(), 1);
  assert.equal(ccMock.mock.callCount(), 1);
});

test("empty selection mengembalikan resolver kosong tanpa fallback", {
  concurrency: false,
}, async () => {
  findManyMock.mock.resetCalls();
  const result = await resolveProgramPeriod({ year: 2027, period: "TW4" });
  assert.deepEqual(result.programs, []);
  assert.deepEqual(result.programIds, []);
  assert.equal(result.target, 0);
  assert.deepEqual(
    (findManyMock.mock.calls as any)[0]?.arguments[0].where.category,
    { targetUnit: "KEGIATAN" },
  );
});
