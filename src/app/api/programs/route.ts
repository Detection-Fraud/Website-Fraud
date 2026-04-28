import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const programs = await prisma.programBudaya.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(
      successResponse(programs, "Berhasil mengambil data program budaya"),
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(errorResponse("Gagal mengambil data program"), {
      status: 500,
    });
  }
}
