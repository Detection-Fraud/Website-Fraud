import { prisma } from "@/lib/prisma";
import { Prisma } from "@generated/prisma";

export async function getTopUnits(
  whereClause: Prisma.ActivityReportWhereInput,
) {
  const topUnitRaw = await prisma.activityReport.groupBy({
    by: ["unitId"],
    where: {
      ...whereClause,
      unitId: { not: null },
    },
    _count: { id: true },
    orderBy: {
      _count: { id: "desc" },
    },
    take: 5,
  });

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
