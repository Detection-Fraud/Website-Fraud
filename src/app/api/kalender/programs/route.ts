import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user)
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });

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

    const PROGRAM_COLORS = [
      "#3b82f6", // blue
      "#10b981", // emerald
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // violet
      "#ec4899", // pink
      "#06b6d4", // cyan
    ];

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
    console.error("API Kalender Programs Error:", error);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}
