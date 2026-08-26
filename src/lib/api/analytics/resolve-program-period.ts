import { prisma } from "@/lib/prisma";
import { programYearBounds } from "@/lib/program-period";

export type AnalyticsPeriod =
  | "TW1"
  | "TW2"
  | "TW3"
  | "TW4"
  | "SM1"
  | "SM2"
  | "ALL";

const PERIOD_TW: Record<AnalyticsPeriod, number[]> = {
  TW1: [1],
  TW2: [2],
  TW3: [3],
  TW4: [4],
  SM1: [1, 2],
  SM2: [3, 4],
  ALL: [1, 2, 3, 4],
};

export function isAnalyticsPeriod(value: string): value is AnalyticsPeriod {
  return value in PERIOD_TW;
}

export async function resolveProgramPeriod(input: {
  year: number;
  period: AnalyticsPeriod;
  programId?: string;
}) {
  const twValues = PERIOD_TW[input.period];
  const programs = await prisma.programBudaya.findMany({
    where: {
      startDate: programYearBounds(input.year),
      tw: { in: twValues },
      ...(input.programId ? { id: input.programId } : {}),
    },
    select: {
      id: true,
      name: true,
      frequency: true,
      tw: true,
      startDate: true,
      endDate: true,
    },
    orderBy: [{ startDate: "asc" }, { name: "asc" }],
  });

  return {
    year: input.year,
    twValues,
    programs,
    programIds: programs.map((program) => program.id),
    target: programs.reduce((sum, program) => sum + program.frequency, 0),
  };
}
