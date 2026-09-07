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
  approvalRate: number;
  approved: number;
  submitted: number;
  earliestApprovedAt: Date | null;
}

export function sortRankingCC<T extends RankingSortItem>(items: T[]) {
  return [...items].sort((a, b) => {
    // Semua pencapaian >= 100% berada di atas yang belum mencapai target.
    const aReachedTarget = a.approvalRate >= 100 ? 1 : 0;
    const bReachedTarget = b.approvalRate >= 100 ? 1 : 0;
    if (aReachedTarget !== bReachedTarget) return bReachedTarget - aReachedTarget;

    // Di dalam kelompok yang sama, approval admin paling awal menjadi prioritas.
    // Yang belum pernah di-approve ditempatkan setelah yang sudah di-approve.
    if (a.earliestApprovedAt && b.earliestApprovedAt) {
      const approvalOrder =
        a.earliestApprovedAt.getTime() - b.earliestApprovedAt.getTime();
      if (approvalOrder !== 0) return approvalOrder;
    } else if (a.earliestApprovedAt || b.earliestApprovedAt) {
      return a.earliestApprovedAt ? -1 : 1;
    }

    // Fallback deterministik untuk data lama tanpa log approval atau timestamp sama.
    return b.approvalRate - a.approvalRate || b.approved - a.approved || b.submitted - a.submitted;
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
  if (unitType === "WILAYAH") targetUnitTypes = [UnitType.KANTOR_WILAYAH];
  else if (unitType === "CABANG") targetUnitTypes = [UnitType.KANTOR_CABANG];
  else if (unitType === "DIVISI") targetUnitTypes = [UnitType.DIVISI];

  let eligibleCreatedByIds: string[] | undefined;
  if (targetUnitTypes) {
    const eligibleUsers = await prisma.user.findMany({
      where: { unit: { type: { in: targetUnitTypes } } },
      select: { id: true },
    });
    eligibleCreatedByIds = eligibleUsers.map((u) => u.id);

    // Short-circuit: jika tidak ada user untuk tipe unit ini, langsung return kosong
    if (eligibleCreatedByIds.length === 0) {
      return { rankingCC: [], rankingCCTotal: 0, rankingCCTotalPages: 0 };
    }
  }
  const ccWhereClause = {
    ...whereClause,
    ...(eligibleCreatedByIds
      ? { createdById: { in: eligibleCreatedByIds } }
      : {}),
  };

  // 1. GroupBy createdById - hitung total submit
  // NOTE: Harus pakai AND agar createdById: { not: null } tidak overwrite
  // createdById: { in: eligibleCreatedByIds } dari ccWhereClause (JS spread = last key wins)
  const submitCounts = await prisma.activityReport.groupBy({
    by: ["createdById"],
    where: {
      AND: [ccWhereClause, { createdById: { not: null } }],
    },
    _count: { id: true },
  });

  if (submitCounts.length === 0) {
    return { rankingCC: [], rankingCCTotal: 0, rankingCCTotalPages: 0 };
  }

  // 2. GroupBy createdById — hitung total approved
  const createdByIds = submitCounts
    .map((s) => s.createdById)
    .filter(Boolean) as string[];

  const approvedCounts = await prisma.activityReport.groupBy({
    by: ["createdById"],
    where: {
      AND: [
        ccWhereClause,
        { status: "APPROVED", createdById: { in: createdByIds } },
      ],
    },
    _count: { id: true },
  });

  const approvedMap = new Map(
    approvedCounts.map((a) => [a.createdById, a._count.id]),
  );

  // Ambil approval pertama admin per CC sebagai tie-break ranking.
  const approvedReports = await prisma.activityReport.findMany({
    where: {
      AND: [
        ccWhereClause,
        { status: "APPROVED", createdById: { in: createdByIds } },
      ],
    },
    select: {
      createdById: true,
      logs: {
        where: { action: "APPROVED" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const earliestApprovedMap = new Map<string, Date>();
  for (const report of approvedReports) {
    const approvedAt = report.logs[0]?.createdAt;
    if (!report.createdById || !approvedAt) continue;
    const current = earliestApprovedMap.get(report.createdById);
    if (!current || approvedAt < current) {
      earliestApprovedMap.set(report.createdById, approvedAt);
    }
  }

  // 3. Fetch user info (nama + unit)
  const users = await prisma.user.findMany({
    where: { id: { in: createdByIds } },
    select: {
      id: true,
      name: true,
      unit: { select: { name: true, type: true } },
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // 4. Susun ranking — sort: compliancePercent (kedisiplinan individu) DESC, approved DESC, approvalRate DESC
  const allRankings = sortRankingCC(
    submitCounts.map((item) => {
      const user = userMap.get(item.createdById!);
      const submitted = item._count.id;
      const approved = approvedMap.get(item.createdById!) ?? 0;
      const compliancePercent = Number(
        (Math.min(approved / effectiveTarget, 1) * 100).toFixed(1),
      );

      return {
        userId: item.createdById!,
        name: user?.name ?? "Unknown",
        unitName: user?.unit?.name ?? "-",
        unitType: user?.unit?.type ?? "-",
        submitted,
        approved,
        target: Math.round(effectiveTarget),
        approvalRate: compliancePercent,
        status: getApprovalStatusText(compliancePercent),
        earliestApprovedAt: earliestApprovedMap.get(item.createdById!) ?? null,
      };
    }),
  );

  // 5. Pagination
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
