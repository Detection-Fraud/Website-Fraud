import { prisma } from "@/lib/prisma";
import { Prisma } from "@generated/prisma";

export async function getDistribusi(
  whereClause: Prisma.ActivityReportWhereInput,
) {
  const raw = await prisma.activityReport.groupBy({
    by: ["programId"],
    where: {
      AND: [whereClause, { programId: { not: null } }],
    },
    _count: { id: true },
  });

  if (raw.length === 0) return [];

  const programIds = raw
    .map((item) => item.programId)
    .filter(Boolean) as string[];

  const programs = await prisma.programBudaya.findMany({
    where: { id: { in: programIds } },
    select: { id: true, name: true },
  });

  const programMaap = new Map(programs.map((p) => [p.id, p.name]));

  const formatted = raw
    .map((item) => ({
      name: programMaap.get(item.programId!) || "Lainnya",
      value: item._count.id,
    }))
    .sort((a, b) => b.value - a.value);

  if (formatted.length <= 5) return formatted;

  const top5 = formatted.slice(0, 5);
  const restSum = formatted.slice(5).reduce((sum, item) => sum + item.value, 0);
  const lainnya = top5.find((item) => item.name === "Lainnya");

  if (lainnya) {
    lainnya.value += restSum;
  } else {
    top5.push({ name: "Lainnya", value: restSum });
  }

  return top5;
}
