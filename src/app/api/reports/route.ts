import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "10"));
    const search = searchParams.get("search") || "";

    // FILTER STATUS & PROGRAM
    const statusFilter = searchParams.get("status") || "ALL";
    const programFilter = searchParams.get("programId") || "ALL";

    // FILTER WILAYAH
    const regionFilter = searchParams.get("regionId") || "ALL";
    const branchFilter = searchParams.get("branchId") || "ALL";

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
          whereClause = { regionId: user.regionId };
        } else if (user.divisionId) {
          whereClause = { divisionId: user.divisionId };
        }
        break;
      case "VIEWER":
        // Viewer hanya bisa lihat laporan sesuai level penempatannya
        if (user.branchId) {
          whereClause = { branchId: user.branchId };
        } else if (user.regionId) {
          whereClause = { regionId: user.regionId };
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

    if (regionFilter !== "ALL") {
      whereClause.regionId = regionFilter;
    }

    if (branchFilter !== "ALL") {
      whereClause.branchId = branchFilter;
    }

    if (programFilter !== "ALL") {
      whereClause.programId = programFilter;
    }

    const baseWhereClause = { ...whereClause };

    if (search) {
      whereClause.OR = [
        { activityName: { contains: search, mode: "insensitive" } },
        { lokasi: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { picKegiatan: { contains: search, mode: "insensitive" } },
        { program: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (statusFilter !== "ALL") {
      whereClause.status = statusFilter;
    }

    const summaryTotal = await prisma.activityReport.count({
      where: baseWhereClause,
    });

    const summaryPending = await prisma.activityReport.count({
      where: { ...baseWhereClause, status: "PENDING" },
    });

    const summaryApproved = await prisma.activityReport.count({
      where: { ...baseWhereClause, status: "APPROVED" },
    });

    const summaryRejected = await prisma.activityReport.count({
      where: { ...baseWhereClause, status: "REJECTED" },
    });

    const skip = (page - 1) * limit;

    const [total, reports] = await Promise.all([
      prisma.activityReport.count({
        where: whereClause,
      }),
      prisma.activityReport.findMany({
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
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json(
      {
        ...successResponse(reports, "Berhasil mengambil data laporan"),
        summary: {
          total: summaryTotal,
          pending: summaryPending,
          approved: summaryApproved,
          rejected: summaryRejected,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
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
    const {
      activityName,
      tanggalKegiatan,
      lokasi,
      description,
      picKegiatan,
      programId,
      uploadedPhotos,
    } = body;

    if (!programId || !tanggalKegiatan) {
      return NextResponse.json(
        errorResponse("Program dan tanggal kegiatan wajib diisi", 400),
        { status: 400 },
      );
    }

    const programData = await prisma.programBudaya.findUnique({
      where: { id: programId },
    });

    if (!programData) {
      return NextResponse.json(errorResponse("Program tidak ditemukan", 400), {
        status: 400,
      });
    }

    const inputDate = new Date(tanggalKegiatan);
    const startDate = new Date(programData.startDate);
    const endDate = new Date(programData.endDate);

    inputDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today > endDate) {
      return NextResponse.json(
        errorResponse("Tanggal kegiatan sudah berakhir", 403),
        { status: 403 },
      );
    }

    if (inputDate < startDate || inputDate > endDate) {
      return NextResponse.json(
        errorResponse("Tanggal kegiatan diluar periode program", 400),
        { status: 400 },
      );
    }

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
          logs: {
            create: {
              action: "SUBMITTED",
              notes: null,
              actorId: user.id,
              actorName: user.name,
              actorRole: user.role,
            },
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
