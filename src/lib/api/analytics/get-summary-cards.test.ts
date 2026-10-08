import assert from "node:assert/strict";
import { mock, test } from "node:test";

const countMock = mock.fn(async (args: { where: Record<string, unknown> }) => {
  if (args.where.status === "APPROVED") return 5;
  if (args.where.status === "PENDING") return 3;
  if (args.where.status === "REJECTED") return 2;
  if (args.where.createdAt) return 4;
  if (
    args.where.programId &&
    args.where.unitId &&
    JSON.stringify(args.where.programId) === JSON.stringify({ in: ["evidence-current"] })
  ) return 10;
  if (args.where.programId) return 7;
  return 10;
});
const groupByMock = mock.fn(
  async (args: { where: Record<string, unknown> }) => {
    assert.ok(args.where);
    return [{ unitId: "unit-1" }, { unitId: "unit-2" }];
  },
);

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: { activityReport: { count: countMock, groupBy: groupByMock } },
  },
});

let getSummaryCards: typeof import("./get-summary-cards").getSummaryCards;
test.before(async () => {
  ({ getSummaryCards } = await import("./get-summary-cards"));
});

test("summary memakai evidence scope untuk total/status/upload dan menghitung pembanding tahun lalu", async () => {
  const whereClause = {
    programId: { in: ["evidence-current"] },
    unitId: { in: ["unit-1"] },
  };
  const previousYearWhereClause = {
    programId: { in: ["evidence-previous"] },
    unitId: "unit-1",
  };

  const summary = await getSummaryCards({
    whereClause,
    previousYearWhereClause,
    year: 2026,
  });

  assert.deepEqual(summary, {
    totalKegiatan: 10,
    totalApproved: 5,
    totalPending: 3,
    totalRejected: 2,
    totalTahunLalu: 7,
    totalUnitAktif: 2,
    laporanBulanIni: 4,
    laporanBulanLalu: 4,
  });
  assert.equal(
    summary.totalKegiatan,
    summary.totalApproved + summary.totalPending + summary.totalRejected,
  );
  const args = countMock.mock.calls.map((call) => call.arguments[0]);
  assert.equal(args[4]?.where, previousYearWhereClause);
  assert.deepEqual(args[5]?.where.programId, whereClause.programId);
  assert.ok(args[5]?.where.createdAt);
  assert.deepEqual(groupByMock.mock.calls[0]?.arguments[0]?.where, {
    AND: [whereClause, { unitId: { not: null } }],
  });
});

test("summary tidak membandingkan program terpilih dengan seluruh laporan tahun lalu", async () => {
  countMock.mock.resetCalls();

  const summary = await getSummaryCards({
    whereClause: { programId: { in: ["program-2026"] } },
    previousYearWhereClause: null,
    year: 2026,
  });

  assert.equal(summary.totalTahunLalu, null);
  assert.equal(countMock.mock.callCount(), 6);
});
