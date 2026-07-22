import { Prisma } from "@generated/prisma";

export interface AnalyticsScope {
  whereClause: Prisma.ActivityReportWhereInput;
  year: number;
  startMonth: number;
  endMonth: number;
}

export interface RankingParams extends AnalyticsScope {
  kanwilId?: string;
  kancabId?: string;
  divisiId?: string;
  unitType: string;
  rankingPage: number;
  rankingUnitId?: string;
  user: {
    role: string;
    unitId: string | null;
    unitType?: string | null;
  };
}

export interface RankingCCParams extends AnalyticsScope {
  page: number;
  limit: number;
  kanwilId?: string;
  kancabId?: string;
  divisiId?: string;
  unitType?: string;
}
