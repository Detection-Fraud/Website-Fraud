import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const user = session.user;

    const { searchParams } = new URL(req.url);
    const month = parseInt(
      searchParams.get("month") || new Date().getMonth().toString(),
    );
    const year = parseInt(
      searchParams.get("year") || new Date().getFullYear().toString(),
    );

    if (isNaN(month) || month < 0 || month > 11) {
      return NextResponse.json(
        errorResponse("Parameter month tidak valid (0-11)", 400),
        { status: 400 },
      );
    }
    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json(
        errorResponse("Parameter year tidak valid", 400),
        { status: 400 },
      );
    }

    // === PERUBAHAN: kanwilId/kancabId/divisiId (bukan regionId/branchId/divisionId) ===
    const kanwilId = searchParams.get("kanwilId");
    const kancabId = searchParams.get("kancabId");
    const divisiId = searchParams.get("divisiId");

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const { whereClause: unitScope } = await resolveScope(user, {
      kanwilId,
      kancabId,
      divisiId,
    });

    let whereClause: any = {
      tanggalKegiatan: {
        gte: startDate,
        lte: endDate,
      },
      ...(user.role === "PIC" && user.unitId
        ? { unitId: user.unitId }
        : unitScope),
    };

    const submissions = await prisma.activityReport.findMany({
      where: whereClause,
      select: {
        id: true,
        tanggalKegiatan: true,
        status: true,
        programId: true,
        unitId: true,
      },
      take: 500,
      orderBy: { tanggalKegiatan: "asc" },
    });

    return NextResponse.json(
      successResponse(submissions, "Successfully fetched submissions", 200),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/kalendar/submissions");
  }
}
