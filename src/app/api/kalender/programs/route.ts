
import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { PROGRAM_COLORS } from "@/lib/api/constants";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const quarter = parseInt(searchParams.get("quarter") || "1");
    const year = parseInt(
      searchParams.get("year") || new Date().getFullYear().toString(),
    );

    const programs = await prisma.programBudaya.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        frequency: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const formattedPrograms = programs.map((p, index) => ({
      id: p.id,
      name: p.name,
      startDate: p.startDate?.toISOString(),
      endDate: p.endDate?.toISOString(),
      frequency: p.frequency || 0,
      color: PROGRAM_COLORS[index % PROGRAM_COLORS.length],
    }));

    return NextResponse.json(
      successResponse(formattedPrograms, "Successfully fetched programs", 200),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/kalender/programs");
  }
}
