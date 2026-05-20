import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return NextResponse.json(errorResponse("Unauthorized", 401), {
      status: 401,
    });
  }

  try {
    const report = await prisma.activityReport.findUnique({
      where: { id },
      include: {
        region: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        program: { select: { name: true } },
        photos: { select: { id: true, originalName: true, imageUrl: true } },
        logs: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            action: true,
            notes: true,
            actorName: true,
            actorRole: true,
            createdAt: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(errorResponse("Laporan tidak ditemukan", 404), {
        status: 404,
      });
    }

    // Non-admin hanya bisa melihat laporan dari unit yang sama persis
    if (user?.role !== "ADMIN") {
      let hasAccess = false;

      if (user?.branchId) {
        // User level kancab → hanya bisa lihat laporan kancab yang sama
        hasAccess = report.branchId === user.branchId;
      } else if (user?.regionId) {
        // User level kanwil → hanya bisa lihat laporan kanwil yang sama
        hasAccess = report.regionId === user.regionId;
      } else if (user?.divisionId) {
        // User level divisi → hanya bisa lihat laporan divisi yang sama
        hasAccess = report.divisionId === user.divisionId;
      }

      if (!hasAccess) {
        return NextResponse.json(
          errorResponse("Anda tidak memiliki akses ke laporan ini", 403),
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      successResponse(report, "Berhasil mengambil data laporan"),
      {
        status: 200,
      },
    );
  } catch (error) {
    return NextResponse.json(
      errorResponse("Gagal mengambil data laporan", 500),
      {
        status: 500,
      },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const { id } = await params;

  if (!session || !session.user) {
    return NextResponse.json(errorResponse("Unauthorized", 401), {
      status: 401,
    });
  }

  try {
    const body = await req.json();
    const {
      activityName,
      programId,
      tanggalKegiatan,
      lokasi,
      description,
      picKegiatan,
      photos,
    } = body;

    const existingReport = await prisma.activityReport.findUnique({
      where: { id },
      include: { photos: true },
    });

    if (!existingReport) {
      return NextResponse.json(errorResponse("Laporan tidak ditemukan", 404), {
        status: 404,
      });
    }

    if (session.user.branchId !== existingReport.branchId) {
      return NextResponse.json(
        errorResponse("Anda tidak memiliki akses ke laporan ini", 403),
        { status: 403 },
      );
    }

    // Hapus foto lama dari Cloudinary & DB jika ada foto baru yang dikirim
    if (photos && photos.length > 0) {
      // Delete dari Cloudinary menggunakan publicId
      for (const photo of existingReport.photos) {
        if (photo.publicId) {
          await cloudinary.uploader.destroy(photo.publicId);
        }
      }

      // Hapus dari database
      await prisma.activityPhoto.deleteMany({
        where: { reportId: id },
      });
    }

    const [updatedReport, _] = await prisma.$transaction([
      prisma.activityReport.update({
        where: { id },
        data: {
          activityName,
          programId: programId || null,
          tanggalKegiatan: new Date(tanggalKegiatan),
          lokasi,
          description,
          picKegiatan,
          status: "PENDING",
          notes: null,
          ...(photos &&
            photos.length > 0 && {
              photos: {
                create: photos.map((p: any) => ({
                  imageUrl: p.imageUrl,
                  originalName: p.originalName,
                  publicId: p.publicId ?? null,
                })),
              },
            }),
        },
      }),
      prisma.activityLog.create({
        data: {
          reportId: id,
          action: "RESUBMITTED",
          notes: null,
          actorId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
        },
      }),
    ]);

    return NextResponse.json(
      successResponse(updatedReport, "Laporan berhasil diperbarui"),
    );
  } catch (error) {
    console.error("ERROR PUT /api/reports/[id]:", error);
    return NextResponse.json(errorResponse("Gagal memperbarui laporan", 500), {
      status: 500,
    });
  }
}
