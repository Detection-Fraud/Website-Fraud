import { prisma } from "@/lib/prisma";
import type { CategoryLocks, CategoryUsage } from "@/types/program-category";
import { Prisma } from "@generated/prisma";

type GroupedCountRow = {
  categoryId: string | null;
  _count: { _all: number | bigint };
};

type ReportCountRow = {
  categoryId: string | null;
  count: number | bigint;
};

function normalizeCount(value: number | bigint): number {
  const count = Number(value);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Category usage count is not a safe non-negative integer");
  }

  return count;
}

function emptyUsage(): CategoryUsage {
  return {
    programCount: 0,
    activeProgramCount: 0,
    reportCount: 0,
    participationCount: 0,
    historyCount: 0,
  };
}

export async function getCategoryUsageByCategoryIds(
  ids: string[],
): Promise<Map<string, CategoryUsage>> {
  const categoryIds = [...new Set(ids)];

  if (categoryIds.length === 0) {
    return new Map();
  }

  const usage = new Map<string, CategoryUsage>(
    categoryIds.map((categoryId) => [categoryId, emptyUsage()]),
  );
  const categoryFilter = { categoryId: { in: categoryIds } };

  const [programRows, activeProgramRows, participationRows, historyRows, reportRows] =
    await Promise.all([
      prisma.programBudaya.groupBy({
        by: ["categoryId"],
        where: categoryFilter,
        _count: { _all: true },
      }),
      prisma.programBudaya.groupBy({
        by: ["categoryId"],
        where: { ...categoryFilter, isActive: true },
        _count: { _all: true },
      }),
      prisma.participationData.groupBy({
        by: ["categoryId"],
        where: categoryFilter,
        _count: { _all: true },
      }),
      prisma.participationScoreHistory.groupBy({
        by: ["categoryId"],
        where: categoryFilter,
        _count: { _all: true },
      }),
      prisma.$queryRaw<ReportCountRow[]>(Prisma.sql`
        SELECT p."categoryId" AS "categoryId", COUNT(*) AS "count"
        FROM "ActivityReport" AS r
        INNER JOIN "ProgramBudaya" AS p ON p."id" = r."programId"
        WHERE p."categoryId" IN (${Prisma.join(categoryIds)})
        GROUP BY p."categoryId"
      `),
    ]);

  const applyGroupedCounts = (
    rows: GroupedCountRow[],
    field: keyof CategoryUsage,
  ) => {
    for (const row of rows) {
      if (row.categoryId === null) continue;

      const categoryUsage = usage.get(row.categoryId);
      if (categoryUsage) {
        categoryUsage[field] = normalizeCount(row._count._all);
      }
    }
  };

  applyGroupedCounts(programRows, "programCount");
  applyGroupedCounts(activeProgramRows, "activeProgramCount");
  applyGroupedCounts(participationRows, "participationCount");
  applyGroupedCounts(historyRows, "historyCount");

  for (const row of reportRows) {
    if (row.categoryId === null) continue;

    const categoryUsage = usage.get(row.categoryId);
    if (categoryUsage) {
      categoryUsage.reportCount = normalizeCount(row.count);
    }
  }

  return usage;
}

export function getCategoryLocks(usage: CategoryUsage): CategoryLocks {
  const used =
    usage.programCount > 0 ||
    usage.reportCount > 0 ||
    usage.participationCount > 0 ||
    usage.historyCount > 0;

  return { capability: used, deletion: used };
}
