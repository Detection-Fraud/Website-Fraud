import { prisma } from "@/lib/prisma";
import { AnalyticsScope } from "./types";

export async function getSummaryCards(scope: AnalyticsScope) {
  const { whereClause, year, startMonth, endMonth } = scope;

  const summaryStartDate = new Date(year, startMonth, 1);
  const summaryEndDate = new Date(year, endMonth + 1, 0, 23, 59, 59);

  const summaryWhereClause = {
    ...whereClause,
    tanggalKegiatan: { gte: summaryStartDate, lte: summaryEndDate },
  };

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
    where: { ...whereClause, unitId: { not: null } },
  });

  return {
    totalKegiatan,
    totalApproved,
    totalPending,
    totalRejected,
    totalUnitAktif: totalUnitAktifRaw.length,
    laporanBulanIni,
    laporanBulanLalu,
  };
}
