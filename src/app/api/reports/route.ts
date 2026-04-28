import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    let whereClause: any = {};

    switch (user.role) {
      case "ADMIN":
        break;
      case "REGION":
        whereClause = {
          regionId: user.regionId,
        };
        break;
      case "BRANCH":
        whereClause = {
          branchId: user.branchId,
        };
        break;
      case "DIVISION":
        whereClause = {
          divisionId: user.divisionId,
        };
        break;
      default:
        return NextResponse.json(
          errorResponse("Akses ditolak - Role tidak dikenali", 403),
          { status: 403 },
        );
    }

    const reports = await prisma.activityReport.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        region: { select: { nama: true } },
        branch: { select: { name: true } },
        division: { select: { name: true } },
      },
    });

    return NextResponse.json(
      successResponse(reports, "Berhasil mengambil data laporan"),
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(errorResponse("Gagal mengambil data laporan"), {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const body = await request.json();
    const { activityName, quarterPeriod, year, claimedCount, uploadedPhotos } =
      body;

    const result = await prisma.$transaction(async (tx) => {
      const newReport = await tx.activityReport.create({
        data: {
          activityName,
          quarterPeriod,
          year,
          claimedCount,
          regionId: user.regionId,
          branchId: user.branchId,
          divisionId: user.divisionId,

          photos: {
            create: uploadedPhotos.map((photo: any) => ({
              originalName: photo.originalName,
              imageUrl: photo.imageUrl,
            })),
          },
        },
        include: {
          photos: true,
        },
      });

      return newReport;
    });

    return NextResponse.json(
      successResponse(result, "Laporan berhasil dibuat"),
      { status: 200 },
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}
