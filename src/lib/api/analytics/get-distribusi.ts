import { prisma } from "@/lib/prisma";
import { Prisma } from "@generated/prisma";

export async function getDistribusi(
  whereClause: Prisma.ActivityReportWhereInput,
  startMonth: number,
  endMonth: number,
  year: number,
) {
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59);

  const raw = await prisma.activityReport.groupBy({
    by: ["programId"],
    where: {
      ...whereClause,
      programId: { not: null },
      tanggalKegiatan: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  const programIds = raw
    .map((item) => item.programId)
    .filter(Boolean) as string[];

  const programs = await prisma.programBudaya.findMany({
    where: { id: { in: programIds } },
    select: { id: true, name: true },
  });

  return raw.map((item) => ({
    name: programs.find((p) => p.id === item.programId)?.name || "Lainnya",
    value: item._count.id,
  }));
}
