import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const regions = await prisma.region.findMany({
      include: {
        branches: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(
      successResponse(regions, "Berhasil mengambil data wilayah"),
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(errorResponse("Gagal mengambil data wilayah"), {
      status: 500,
    });
  }
}
