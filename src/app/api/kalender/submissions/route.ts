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

    const regionId =
      searchParams.get("regionId") === "ALL"
        ? null
        : searchParams.get("regionId");
    const branchId =
      searchParams.get("branchId") === "ALL"
        ? null
        : searchParams.get("branchId");
    const divisionId =
      searchParams.get("divisionId") === "ALL"
        ? null
        : searchParams.get("divisionId");

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    let whereClause: any = {
      tanggalKegiatan: {
        gte: startDate,
        lte: endDate,
      },
    };

    const userRole = user.role;
    const userRegion = user.regionId;
    const userBranch = user.branchId;
    const userDivision = user.divisionId;

    if (userRole === "PIC" || userRole === "VIEWER") {
      if (userDivision) {
        whereClause.divisionId = userDivision;
      } else if (userBranch) {
        whereClause.branchId = userBranch;
      } else if (userRegion) {
        whereClause.regionId = userRegion;
        if (branchId) whereClause.branchId = branchId;
      } else {
        // PIC Pusat / Kantor Pusat
        if (divisionId) {
          whereClause.divisionId = divisionId;
        } else if (regionId) {
          whereClause.regionId = regionId;
          if (branchId) whereClause.branchId = branchId;
        }
      }
    } else if (userRole === "ADMIN") {
      if (divisionId) {
        whereClause.divisionId = divisionId;
      } else if (regionId) {
        whereClause.regionId = regionId;
        if (branchId) whereClause.branchId = branchId;
      }
    }

    const submissions = await prisma.activityReport.findMany({
      where: whereClause,
      select: {
        id: true,
        tanggalKegiatan: true,
        status: true,
        programId: true,
        regionId: true,
        branchId: true,
        divisionId: true,
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
