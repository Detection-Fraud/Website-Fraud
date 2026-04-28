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
        // Admin bisa lihat semua laporan
        break;
      case "PIC":
        // PIC filter berdasarkan branchId (jika ada), jika tidak, regionId
        if (user.branchId) {
          whereClause = { branchId: user.branchId };
        } else if (user.regionId) {
          whereClause = { regionId: user.regionId, branchId: null };
        } else if (user.divisionId) {
          whereClause = { divisionId: user.divisionId };
        }
        break;
      case "VIEWER":
        // Viewer hanya bisa lihat laporan sesuai level penempatannya
        if (user.branchId) {
          whereClause = { branchId: user.branchId };
        } else if (user.regionId) {
          whereClause = { regionId: user.regionId, branchId: null };
        } else if (user.divisionId) {
          whereClause = { divisionId: user.divisionId };
        }
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
        region: { select: { name: true } },
        branch: { select: { name: true } },
        division: { select: { name: true } },
        program: { select: { name: true } },
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
    console.log("DEBUG POST /api/reports body:", JSON.stringify(body, null, 2));
    const {
      activityName,
      tanggalKegiatan,
      lokasi,
      description,
      picKegiatan,
      programId,
      uploadedPhotos,
    } = body;

    const result = await prisma.$transaction(async (tx) => {
      const newReport = await tx.activityReport.create({
        data: {
          activityName,
          tanggalKegiatan: new Date(tanggalKegiatan),
          lokasi,
          description,
          picKegiatan,
          programId: programId || null,
          regionId: user.regionId || null,
          branchId: user.branchId || null,
          divisionId: user.divisionId || null,

          photos: {
            create:
              uploadedPhotos?.map((photo: any) => ({
                originalName: photo.originalName,
                imageUrl: photo.imageUrl,
              })) || [],
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
  } catch (error: any) {
    console.error("ERROR POST /api/reports:", error);
    const message = error?.message || "Internal Server Error";
    return NextResponse.json(errorResponse(message, 500), {
      status: 500,
    });
  }
}
