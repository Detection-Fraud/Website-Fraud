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
    const month = parseInt(
      searchParams.get("month") || new Date().getMonth().toString(),
    );
    const year = parseInt(
      searchParams.get("year") || new Date().getFullYear().toString(),
    );

    // === PERUBAHAN: kanwilId/kancabId/divisiId (bukan regionId/branchId/divisionId) ===
    const kanwilId =
      searchParams.get("kanwilId") === "ALL"
        ? null
        : searchParams.get("kanwilId");
    const kancabId =
      searchParams.get("kancabId") === "ALL"
        ? null
        : searchParams.get("kancabId");
    const divisiId =
      searchParams.get("divisiId") === "ALL"
        ? null
        : searchParams.get("divisiId");

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    let whereClause: any = {
      tanggalKegiatan: {
        gte: startDate,
        lte: endDate,
      },
    };

    // === PERUBAHAN: role-based scope menggunakan unitId ===
    if (user.role === "PIC" || user.role === "VIEWER") {
      if (user.unitId) {
        if (user.unitType === "KANTOR_WILAYAH") {
          const childIds = await prisma.unit.findMany({
            where: { parentId: user.unitId },
            select: { id: true },
          });
          whereClause.unitId = {
            in: [user.unitId, ...childIds.map((c) => c.id)],
          };
        } else {
          whereClause.unitId = user.unitId;
        }
      }
    } else if (user.role === "ADMIN") {
      // Admin: terapkan filter manual jika dipilih
      if (kancabId) {
        whereClause.unitId = kancabId;
      } else if (kanwilId) {
        const childIds = await prisma.unit.findMany({
          where: { parentId: kanwilId },
          select: { id: true },
        });
        whereClause.unitId = {
          in: [kanwilId, ...childIds.map((c) => c.id)],
        };
      } else if (divisiId) {
        whereClause.unitId = divisiId;
      }
    }

    const submissions = await prisma.activityReport.findMany({
      where: whereClause,
      select: {
        id: true,
        tanggalKegiatan: true,
        status: true,
        programId: true,
        unitId: true,
      },
    });

    return NextResponse.json(
      successResponse(submissions, "Successfully fetched submissions", 200),
      { status: 200 },
    );
  } catch (error) {
    console.error("API Kalender Submissions Error:", error);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}
