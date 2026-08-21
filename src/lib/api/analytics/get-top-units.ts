import { prisma } from "@/lib/prisma";
import { Prisma } from "@generated/prisma";

interface GetTopUnitsParams {
  whereClause: Prisma.ActivityReportWhereInput;
  year: number;
  startMonth: number;
  endMonth: number;
}
export async function getTopUnits({
  whereClause,
  year,
  startMonth,
  endMonth,
}: GetTopUnitsParams) {
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59);

  const topUnitRaw = await prisma.activityReport.groupBy({
    by: ["unitId"],
    where: {
      ...whereClause,
      unitId: { not: null },
      tanggalKegiatan: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
    orderBy: {
      _count: { id: "desc" },
    },
    take: 5,
  });

  if (topUnitRaw.length === 0) return [];

  const unitIds = topUnitRaw
    .map((item) => item.unitId)
    .filter(Boolean) as string[];

  const unitsData = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    select: { id: true, name: true, type: true },
  });

  return topUnitRaw.map((item) => {
    const unitInfo = unitsData.find((u) => u.id === item.unitId);
    return {
      name: unitInfo?.name || "Unknown Unit",
      jumlah: item._count.id,
      type:
        unitInfo?.type === "KANTOR_CABANG"
          ? "Kancab"
          : unitInfo?.type === "KANTOR_WILAYAH"
            ? "Kanwil"
            : "Divisi",
    };
  });
}
