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
  approvalRate: number;
  status: string;
}

export async function getRankingCC(params: RankingCCParams) {
  const {
    whereClause,
    page,
    limit = DEFAULT_PAGE_SIZE,
    startMonth = 0,
    year,
    endMonth = 11,
    unitType,
  } = params;

  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59);

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
    tanggalKegiatan: { gte: startDate, lte: endDate },
    ...(eligibleCreatedByIds
      ? { createdById: { in: eligibleCreatedByIds } } // ✅ filter skalar, bukan relasi
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

  // 4. Susun ranking — sort: approved DESC, submitted DESC, approvalRate DESC
  const allRankings = submitCounts
    .map((item) => {
      const user = userMap.get(item.createdById!);
      const submitted = item._count.id;
      const approved = approvedMap.get(item.createdById!) ?? 0;
      const approvalRate =
        submitted > 0 ? Number(((approved / submitted) * 100).toFixed(1)) : 0;

      return {
        userId: item.createdById!,
        name: user?.name ?? "Unknown",
        unitName: user?.unit?.name ?? "-",
        unitType: user?.unit?.type ?? "-",
        submitted,
        approved,
        approvalRate,
        status: getApprovalStatusText(approvalRate),
      };
    })
    .sort(
      (a, b) =>
        b.approved - a.approved ||
        b.approvalRate - a.approvalRate ||
        b.submitted - a.submitted,
    );

  // 5. Pagination
  const rankingCCTotal = allRankings.length;
  const rankingCCTotalPages = Math.ceil(rankingCCTotal / limit);

  const rankingCC: RankingCCItem[] = allRankings
    .slice((page - 1) * limit, page * limit)
    .map((item, idx) => ({
      ...item,
      rank: (page - 1) * limit + idx + 1,
    }));

  return {
    rankingCC,
    rankingCCTotal,
    rankingCCTotalPages,
  };
}
