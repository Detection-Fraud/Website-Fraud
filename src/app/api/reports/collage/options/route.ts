import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { getExactPicUnitId } from "@/lib/api/collage";
import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await requireAuth();
    const unitId = getExactPicUnitId(session.user);

    const programs = await prisma.programBudaya.findMany({
      where: {
        category: { is: { targetUnit: "KEGIATAN" } },
        activityReports: {
          some: { unitId, status: "APPROVED", photos: { some: {} } },
        },
      },
      select: {
        id: true,
        name: true,
        tw: true,
        startDate: true,
        endDate: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
    });

    const categories = Array.from(
      new Map(
        programs
          .filter((program) => program.category)
          .map((program) => [program.category?.id, program.category!]),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name, "id"));

    return NextResponse.json(
      successResponse({
        unit: { id: unitId, name: session.user.unitName || "Unit Kerja" },
        categories,
        programs: programs.filter((program) => program.category),
      }),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/collage/options");
  }
}
