import { prisma } from "@/lib/prisma";
import { UnitType } from "@generated/prisma";
import { getApprovalStatusText } from "../constants";
import { RankingCCParams } from "./types";

const DEFAULT_PAGE_SIZE = 10;

export interface RankingCCItem {
  rank: number;
  userId: string;
  name: string;
  unitName: string;
  unitType: string;
  submitted: number;
  approved: number;
  target: number;
  approvalRate: number;
  status: string;
}

interface RankingSortItem {
  userId: string;
  approvalRate: number;
  approved: number;
  submitted: number;
  reachedTarget: boolean;
  targetCompletionAt: Date | null;
}

export function getTargetCompletionAt(
  approvalTimes: Date[],
  target: number,
): Date | null {
  return approvalTimes[target - 1] ?? null;
}

export function getApprovalTimesForReport(
  logs: Array<{ createdAt: Date }>,
  updatedAt: Date,
): Date[] {
  return [logs[0]?.createdAt ?? updatedAt];
}

export function sortRankingCC<T extends RankingSortItem>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.reachedTarget !== b.reachedTarget) {
      return a.reachedTarget ? -1 : 1;
    }

    if (a.reachedTarget && b.reachedTarget) {
      const aTime = a.targetCompletionAt?.getTime() ?? Infinity;
      const bTime = b.targetCompletionAt?.getTime() ?? Infinity;

      if (aTime !== bTime) return aTime - bTime;
    } else if (a.approvalRate !== b.approvalRate) {
      return b.approvalRate - a.approvalRate;
    }

    return (
      b.approved - a.approved ||
      b.submitted - a.submitted ||
      a.userId.localeCompare(b.userId)
    );
  });
}

export async function getRankingCC(params: RankingCCParams) {
  const {
    whereClause,
    page,
    limit = DEFAULT_PAGE_SIZE,
    unitType,
    programTarget,
  } = params;

  const effectiveTarget = programTarget > 0 ? programTarget : 1;

  let targetUnitTypes: UnitType[] | undefined;

  if (unitType === "WILAYAH") {
    targetUnitTypes = [UnitType.KANTOR_WILAYAH];
  } else if (unitType === "CABANG") {
    targetUnitTypes = [UnitType.KANTOR_CABANG];
  } else if (unitType === "DIVISI") {
    targetUnitTypes = [UnitType.DIVISI];
  }

  let eligibleCreatedByIds: string[] | undefined;

  if (targetUnitTypes) {
    const eligibleUsers = await prisma.user.findMany({
      where: { unit: { type: { in: targetUnitTypes } } },
      select: { id: true },
    });

    eligibleCreatedByIds = eligibleUsers.map((u) => u.id);

    if (eligibleCreatedByIds.length === 0) {
      return {
        rankingCC: [],
        rankingCCTotal: 0,
        rankingCCTotalPages: 0,
      };
    }
  }

  const ccWhereClause = {
    ...whereClause,
    ...(eligibleCreatedByIds
      ? { createdById: { in: eligibleCreatedByIds } }
      : {}),
  };

  const submitCounts = await prisma.activityReport.groupBy({
    by: ["createdById"],
    where: {
      AND: [ccWhereClause, { createdById: { not: null } }],
    },
    _count: { id: true },
  });

  if (submitCounts.length === 0) {
    return {
      rankingCC: [],
      rankingCCTotal: 0,
      rankingCCTotalPages: 0,
    };
  }

  const createdByIds = submitCounts
    .map((s) => s.createdById)
    .filter(Boolean) as string[];

  const approvedCounts = await prisma.activityReport.groupBy({
    by: ["createdById"],
    where: {
      AND: [
        ccWhereClause,
        {
          status: "APPROVED",
          createdById: { in: createdByIds },
        },
      ],
    },
    _count: { id: true },
  });

  const approvedMap = new Map(
    approvedCounts.map((a) => [a.createdById, a._count.id]),
  );

  const approvedReports = await prisma.activityReport.findMany({
    where: {
      AND: [
        ccWhereClause,
        {
          status: "APPROVED",
          createdById: { in: createdByIds },
        },
      ],
    },
    select: {
      createdById: true,
      updatedAt: true,
      logs: {
        where: { action: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const approvalTimesByUser = new Map<string, Date[]>();

  for (const report of approvedReports) {
    if (!report.createdById) continue;

    const reportApprovalTimes = getApprovalTimesForReport(
      report.logs,
      report.updatedAt,
    );

    const currentTimes = approvalTimesByUser.get(report.createdById) ?? [];

    currentTimes.push(...reportApprovalTimes);
    approvalTimesByUser.set(report.createdById, currentTimes);
  }

  for (const approvalTimes of approvalTimesByUser.values()) {
    approvalTimes.sort((a, b) => a.getTime() - b.getTime());
  }

  const users = await prisma.user.findMany({
    where: { id: { in: createdByIds } },
    select: {
      id: true,
      name: true,
      unit: { select: { name: true, type: true } },
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const allRankings = sortRankingCC(
    submitCounts.map((item) => {
      const user = userMap.get(item.createdById!);
      const submitted = item._count.id;
      const approved = approvedMap.get(item.createdById!) ?? 0;
      const approvalRate = Number(
        (Math.min(approved / effectiveTarget, 1) * 100).toFixed(1),
      );
      const reachedTarget = approved >= effectiveTarget;
      const approvalTimes = approvalTimesByUser.get(item.createdById!) ?? [];

      return {
        userId: item.createdById!,
        name: user?.name ?? "Unknown",
        unitName: user?.unit?.name ?? "-",
        unitType: user?.unit?.type ?? "-",
        submitted,
        approved,
        target: Math.round(effectiveTarget),
        approvalRate,
        status: getApprovalStatusText(approvalRate),
        reachedTarget,
        targetCompletionAt: getTargetCompletionAt(
          approvalTimes,
          effectiveTarget,
        ),
      };
    }),
  );

  const rankingCCTotal = allRankings.length;
  const rankingCCTotalPages = Math.ceil(rankingCCTotal / limit);

  const rankingCC: RankingCCItem[] = allRankings
    .slice((page - 1) * limit, page * limit)
    .map((item, idx) => ({
      rank: (page - 1) * limit + idx + 1,
      userId: item.userId,
      name: item.name,
      unitName: item.unitName,
      unitType: item.unitType,
      submitted: item.submitted,
      approved: item.approved,
      target: item.target,
      approvalRate: item.approvalRate,
      status: item.status,
    }));

  return {
    rankingCC,
    rankingCCTotal,
    rankingCCTotalPages,
  };
}
