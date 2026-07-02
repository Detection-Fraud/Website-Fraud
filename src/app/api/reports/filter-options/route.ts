
import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { PROGRAM_COLORS } from "@/lib/api/constants";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await requireAuth();

    const [kanwilList, divisiList, programs] = await Promise.all([
      prisma.unit.findMany({
        where: { type: "KANTOR_WILAYAH" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.unit.findMany({
        where: { type: "DIVISI" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.programBudaya.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const programList = programs.map((p, index) => ({
      id: p.id,
      name: p.name,
      color: PROGRAM_COLORS[index % PROGRAM_COLORS.length],
    }));

    return NextResponse.json(
      successResponse(
        {
          kanwilList,
          divisiList,
          programList,
        },
        "Berhasil mengambil opsi filter",
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/filter-options");
  }
}
