import { requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { ParticipationRankingItem } from "@/types/participation.types";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const rankingQuerySchema = z.object({
  year: z.coerce.number().int().default(new Date().getFullYear()),
  tw: z.coerce.number().int().min(1).max(4).nullable().optional(),
  unitType: z.enum(["ALL", "WILAYAH", "CABANG", "DIVISI"]).default("ALL"),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const parsed = rankingQuerySchema.safeParse({
      year: searchParams.get("year") || undefined,
      tw: searchParams.get("tw") || undefined,
      unitType: searchParams.get("unitType") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
        { status: 400 },
      );
    }

    const { year, tw, unitType } = parsed.data;

    const unitWhere: any = {};
    if (unitType === "WILAYAH") unitWhere.type = "KANTOR_WILAYAH";
    else if (unitType === "CABANG") unitWhere.type = "KANTOR_CABANG";
    else if (unitType === "DIVISI") unitWhere.type = "DIVISI";

    const units = await prisma.unit.findMany({
      where: unitWhere,
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });

    const participationWhere: any = {
      year,
      unitId: { in: units.map((u) => u.id) },
    };
    if (tw) participationWhere.tw = tw;

    const participationRows = await prisma.participationData.findMany({
      where: participationWhere,
      select: {
        unitId: true,
        percentage: true,
        category: {
          select: { id: true, name: true },
        },
      },
    });

    const unitDataMap = new Map<
      string,
      {
        percentages: number[];
        categories: {
          categoryId: string;
          categoryName: string;
          percentage: number;
        }[];
      }
    >();

    for (const row of participationRows) {
      if (!unitDataMap.has(row.unitId)) {
        unitDataMap.set(row.unitId, { percentages: [], categories: [] });
      }
      const entry = unitDataMap.get(row.unitId)!;
      entry.percentages.push(row.percentage);
      entry.categories.push({
        categoryId: row.category.id,
        categoryName: row.category.name,
        percentage: row.percentage,
      });
    }

    // [UPDATED] Extract unique categories dari participationRows untuk metadata kolom dinamis
    // Dipakai component untuk build dynamic columns (satu kolom per kategori)
    const categoryMap = new Map<string, string>();
    for (const row of participationRows) {
      if (!categoryMap.has(row.category.id)) {
        categoryMap.set(row.category.id, row.category.name);
      }
    }
    const categories = Array.from(categoryMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const rankings: ParticipationRankingItem[] = units
      .map((unit) => {
        const entry = unitDataMap.get(unit.id);
        const hasData = entry !== undefined && entry.percentages.length > 0;
        const avg = hasData
          ? Math.round(
              entry!.percentages.reduce((a, b) => a + b, 0) /
                entry!.percentages.length,
            )
          : null;

        return {
          rank: 0,
          unitId: unit.id,
          unitName: unit.name,
          unitType: unit.type,
          averagePercentage: avg,
          hasData,
          categoriesCount: hasData ? entry!.categories.length : 0,
          // [UPDATED] field baru: categories breakdown per unit
          categories: hasData ? entry!.categories : [],
        };
      })
      .sort((a, b) => {
        if (a.hasData && !b.hasData) return -1;
        if (!a.hasData && b.hasData) return 1;
        if (!a.hasData && !b.hasData) return 0;
        return (b.averagePercentage ?? 0) - (a.averagePercentage ?? 0);
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return NextResponse.json(
      successResponse(
        // [UPDATED] tambah field `categories` metadata untuk dynamic columns di frontend
        { ranking: rankings, categories, total: rankings.length },
        "Ranking partisipasi diambil",
      ),
    );
  } catch (error) {
    console.error("ERROR GET /api/participation/ranking:", error);
    return NextResponse.json(
      errorResponse("Gagal mengambil ranking partisipasi", 500),
      { status: 500 },
    );
  }
}
