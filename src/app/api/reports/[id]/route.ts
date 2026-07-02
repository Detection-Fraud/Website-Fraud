import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { checkReportAccess } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { unlink } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await requireAuth();
    const user = session.user;

    const report = await prisma.activityReport.findUnique({
      where: { id },
      include: {
        // === PERUBAHAN: region/branch/division → unit + parent ===
        unit: {
          select: {
            id: true,
            name: true,
            type: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
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

    // === PERUBAHAN: Access check menggunakan unitId ===
    if (user.role !== "ADMIN") {
      if (!checkReportAccess(user, report)) {
        return NextResponse.json(
          errorResponse("Anda tidak memiliki akses ke laporan ini", 403),
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      successResponse(report, "Berhasil mengambil data laporan"),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "GET /api/reports/[id]");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();

    const { id } = await params;

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

    // === PERUBAHAN: branchId → unitId ===
    if (session.user.unitId !== existingReport.unitId) {
      return NextResponse.json(
        errorResponse("Anda tidak memiliki akses ke laporan ini", 403),
        { status: 403 },
      );
    }

    if (photos && photos.length > 0) {
      for (const photo of existingReport.photos) {
        if (photo.publicId && !photo.imageUrl.startsWith("http")) {
          try {
            const filePath = path.join(
              process.cwd(),
              "public",
              "uploads",
              photo.publicId,
            );
            await unlink(filePath);
          } catch (err) {
            console.warn(`[WARN] Gagal menghapus file lokal ${photo.publicId}`);
          }
        }
      }

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
    return handleApiError(error, "PUT /api/reports/[id]");
  }
}
