import { getDistribusi } from "@/lib/api/analytics/get-distribusi";
import { getMonthlyTrend } from "@/lib/api/analytics/get-monthly-trend";
import { getRanking } from "@/lib/api/analytics/get-ranking";
import { getSummaryCards } from "@/lib/api/analytics/get-summary-cards";
import { getTopUnits } from "@/lib/api/analytics/get-top-units";
import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { getMonthRange } from "@/lib/api/constants";
import { resolveScope } from "@/lib/api/unit-scope";
import { successResponse } from "@/lib/response";
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

    const { whereClause } = await resolveScope(user, {
      kanwilId,
      kancabId,
      divisiId,
    });
    if (programId) whereClause.programId = programId;

    const { startMonth, endMonth } = getMonthRange(periode);

    const [summary, trends, distribusi, ranking, topUnit] = await Promise.all([
      getSummaryCards({ whereClause, year, startMonth, endMonth }),
      getMonthlyTrend(whereClause, year),
      getDistribusi(whereClause, startMonth, endMonth, year),
      getRanking({
        whereClause,
        year,
        startMonth,
        endMonth,
        kanwilId,
        kancabId,
        divisiId,
        unitType,
        rankingPage,
        rankingUnitId,
        user,
      }),
      getTopUnits(whereClause),
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
