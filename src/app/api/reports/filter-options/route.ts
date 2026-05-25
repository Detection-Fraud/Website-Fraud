import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

const PROGRAM_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export async function GET() {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unathorized", 401), {
        status: 401,
      });
    }

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
    console.log("ERROR GET /api/reports/filter-options", error);
    return NextResponse.json(errorResponse("Internal Server Error"), {
      status: 500,
    });
  }
}
