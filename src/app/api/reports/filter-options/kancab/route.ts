import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const kanwilId = searchParams.get("kanwilId");

    if (!kanwilId) {
      return NextResponse.json(errorResponse("kanwilId diperlukan", 400), {
        status: 400,
      });
    }

    const kancabList = await prisma.unit.findMany({
      where: { parentId: kanwilId, type: "KANTOR_CABANG" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      successResponse(kancabList, "Berhasil mengambil data kantor cabang"),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/filter-options/kancab");
  }
}
