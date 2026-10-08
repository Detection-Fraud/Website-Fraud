import { prisma } from "@/lib/prisma";
import { AnalyticsSummaryScope } from "./types";

export async function getSummaryCards(scope: AnalyticsSummaryScope) {
  const { whereClause, previousYearWhereClause } = scope;
  const summaryWhereClause = whereClause;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
  );

  const [
    totalKegiatan,
    totalApproved,
    totalPending,
    totalRejected,
    totalTahunLalu,
    laporanBulanIni,
    laporanBulanLalu,
  ] = await Promise.all([
    prisma.activityReport.count({ where: summaryWhereClause }),
    prisma.activityReport.count({
      where: { ...summaryWhereClause, status: "APPROVED" },
    }),
    prisma.activityReport.count({
      where: { ...summaryWhereClause, status: "PENDING" },
    }),
    prisma.activityReport.count({
      where: { ...summaryWhereClause, status: "REJECTED" },
    }),
    previousYearWhereClause
      ? prisma.activityReport.count({ where: previousYearWhereClause })
      : Promise.resolve(null),
    prisma.activityReport.count({
      where: {
        ...whereClause,
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    prisma.activityReport.count({
      where: {
        ...whereClause,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),
  ]);

  const totalUnitAktifRaw = await prisma.activityReport.groupBy({
    by: ["unitId"],
    where: {
      AND: [summaryWhereClause, { unitId: { not: null } }],
    },
  });

  return {
    totalKegiatan,
    totalApproved,
    totalPending,
    totalRejected,
    totalTahunLalu,
    totalUnitAktif: totalUnitAktifRaw.length,
    laporanBulanIni,
    laporanBulanLalu,
  };
}
