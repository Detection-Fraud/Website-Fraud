import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { buildParticipationExport } from "@/lib/participation-workbook/service";
import { errorResponse } from "@/lib/response";
import { participationFilterSchema } from "@/schemas/participation.schema";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const parsed = participationFilterSchema.safeParse({
      categoryId: searchParams.get("categoryId"),
      tw: searchParams.get("tw"),
      year: searchParams.get("year"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
        { status: 400 },
      );
    }

    const { categoryId, tw, year } = parsed.data;
    const buffer = await buildParticipationExport({
      categoryId,
      tw,
      year,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Export_Partisipasi_TW${tw}_${year}.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/participation/export");
  }
}
