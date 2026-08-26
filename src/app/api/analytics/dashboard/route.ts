import { getDistribusi } from "@/lib/api/analytics/get-distribusi";
import { getMonthlyTrend } from "@/lib/api/analytics/get-monthly-trend";
import { getRanking } from "@/lib/api/analytics/get-ranking";
import { getRankingCC } from "@/lib/api/analytics/get-ranking-cc";
import { getSummaryCards } from "@/lib/api/analytics/get-summary-cards";
import { getTopUnits } from "@/lib/api/analytics/get-top-units";
import {
  isAnalyticsPeriod,
  resolveProgramPeriod,
} from "@/lib/api/analytics/resolve-program-period";
import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { UnitType } from "@generated/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const user = session.user;
    const searchParams = request.nextUrl.searchParams;

    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );
    const periode = searchParams.get("periode") || "ALL";
    const unitType = searchParams.get("unitType") || "ALL";
    const kanwilId = searchParams.get("kanwilId") || undefined;
    const kancabId = searchParams.get("kancabId") || undefined;
    const divisiId = searchParams.get("divisiId") || undefined;
    const rankingPage = parseInt(searchParams.get("rankingPage") || "1");
    const programId = searchParams.get("programId") || undefined;
    const rankingUnitId = searchParams.get("rankingUnitId") || undefined;
    const rankingCCPage = parseInt(searchParams.get("rankingCCPage") || "1");

    const { whereClause } = await resolveScope(user, {
      kanwilId,
      kancabId,
      divisiId,
    });
    if (programId) whereClause.programId = programId;

    // Enrich whereClause berdasarkan unitType yang dipilih user
    // Ini memastikan summary cards, trend, distribusi, dan top unit
    // hanya menghitung data dari tipe unit yang dipilih
    if (unitType !== "ALL") {
      const UNIT_TYPE_MAP: Record<string, UnitType> = {
        WILAYAH: UnitType.KANTOR_WILAYAH,
        CABANG: UnitType.KANTOR_CABANG,
        DIVISI: UnitType.DIVISI,
      };
      const mappedType = UNIT_TYPE_MAP[unitType];
      if (mappedType) {
        const unitsOfType = await prisma.unit.findMany({
          where: { type: mappedType },
          select: { id: true },
        });
        const unitIdsOfType = unitsOfType.map((u) => u.id);

        if (whereClause.unitId) {
          // whereClause sudah punya filter unitId dari resolveScope
          // Intersect: hanya ambil unit yang ada di kedua set
          const existing = whereClause.unitId;
          const existingIds =
            typeof existing === "string"
              ? [existing]
              : Array.isArray((existing as Record<string, unknown>).in)
                ? ((existing as Record<string, unknown>).in as string[])
                : typeof (existing as Record<string, unknown>).equals ===
                    "string"
                  ? [(existing as Record<string, unknown>).equals as string]
                  : [];

          const intersected = existingIds.filter((id: string) =>
            unitIdsOfType.includes(id),
          );
          whereClause.unitId =
            intersected.length === 1 ? intersected[0] : { in: intersected };
        } else {
          // whereClause kosong (admin tanpa filter wilayah spesifik)
          whereClause.unitId = { in: unitIdsOfType };
        }
      }
    }

    const rawPeriod = searchParams.get("periode") || "ALL";
    if (!isAnalyticsPeriod(rawPeriod)) {
      return NextResponse.json(errorResponse("Periode tidak valid", 400), {
        status: 400,
      });
    }

    const [periodScope, previousPeriodScope] = await Promise.all([
      resolveProgramPeriod({ year, period: rawPeriod, programId }),
      resolveProgramPeriod({ year: year - 1, period: rawPeriod }),
    ]);

    whereClause.programId = { in: periodScope.programIds };
    const previousWhereClause = {
      ...whereClause,
      programId: { in: previousPeriodScope.programIds },
    };

    const scope = {
      whereClause,
      year,
      programTarget: periodScope.target,
    };

    const [summary, trends, distribusi, ranking, topUnit, ccRanking] =
      await Promise.all([
        getSummaryCards(scope),
        getMonthlyTrend(whereClause, previousWhereClause, year),
        getDistribusi(whereClause),
        getRanking({
          ...scope,
          kanwilId,
          kancabId,
          divisiId,
          unitType,
          rankingPage,
          rankingUnitId,
          user,
        }),
        getTopUnits({ whereClause }),
        getRankingCC({
          ...scope,
          page: rankingCCPage,
          limit: 10,
          kanwilId,
          kancabId,
          divisiId,
          unitType,
        }),
      ]);

    return NextResponse.json(
      successResponse(
        {
          summary,
          charts: {
            ...trends,
            topUnit,
            distribusiProgram: distribusi,
            ...ranking,
            rankingPage,
            ...ccRanking,
            rankingCCPage,
          },
        },
        "Berhasil mengambil data analytics",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/analytics/dashboard");
  }
}
