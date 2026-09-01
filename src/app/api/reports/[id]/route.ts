import {
  ApiError,
  handleApiError,
  requireAuth,
  requirePic,
} from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  isActivityDateInsideProgram,
  isProgramUploadOpen,
} from "@/lib/program-period";
import { getCapabilityError, requiresEvidence } from "@/lib/program-capabilities";
import { errorResponse, formatZodError, successResponse } from "@/lib/response";
import { updateReportSchema } from "@/schemas/report.schema";
import { Prisma } from "@generated/prisma";
import { unlink } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const reportDetailSelect = Prisma.validator<Prisma.ActivityReportSelect>()({
  id: true,
  activityName: true,
  tanggalKegiatan: true,
  lokasi: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  notes: true,
  unit: {
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
      parent: { select: { id: true, name: true } },
    },
  },
  program: {
    select: {
      id: true,
      name: true,
      category: { select: { id: true, name: true, color: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
  photos: { select: { id: true, originalName: true, imageUrl: true } },
  logs: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reportId: true,
      action: true,
      notes: true,
      actorName: true,
      actorRole: true,
      createdAt: true,
    },
  },
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await requireAuth();
    const user = session.user;

    const scopeWhere: Prisma.ActivityReportWhereInput =
      user.role === "ADMIN"
        ? { id }
        : !user.unitId
          ? { id: "__no_report_access__" }
          : user.unitType === "KANTOR_WILAYAH"
            ? {
                id,
                OR: [
                  { unitId: user.unitId },
                  { unit: { parentId: user.unitId } },
                ],
              }
            : { id, unitId: user.unitId };

    const report = await prisma.activityReport.findFirst({
      where: {
        ...scopeWhere,
        ...(user.role === "PIC" && { createdById: user.id }),
      },
      select: reportDetailSelect,
    });

    if (!report) {
      return NextResponse.json(errorResponse("Laporan tidak ditemukan", 404), {
        status: 404,
      });
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
    const session = await requirePic();
    const { id } = await params;
    const body = await req.json();
    const parsedData = updateReportSchema.safeParse(body);
    if (!parsedData.success) {
      const errorMessage = formatZodError(parsedData.error);
      return NextResponse.json(
        errorResponse(`Validasi gagal: ${errorMessage}`, 400),
        { status: 400 },
      );
    }
    const existingReport = await prisma.activityReport.findUnique({
      where: { id },
      include: { photos: true },
    });
    if (!existingReport) {
      return NextResponse.json(errorResponse("Laporan tidak ditemukan", 404), {
        status: 404,
      });
    }
    if (existingReport.createdById !== session.user.id) {
      return NextResponse.json(
        errorResponse(
          "Hanya pengunggah asli yang dapat memperbarui laporan ini",
          403,
        ),
        { status: 403 },
      );
    }
    if (existingReport.status !== "REJECTED") {
      return NextResponse.json(
        errorResponse(
          "Hanya laporan dengan status ditolak yang dapat diedit",
          409,
        ),
        { status: 409 },
      );
    }

    if (!session.user.unitId || session.user.unitId !== existingReport.unitId) {
      return NextResponse.json(
        errorResponse("Anda tidak memiliki akses ke unit laporan ini", 403),
        { status: 403 },
      );
    }

    const activePic = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        isActive: true,
        unitId: session.user.unitId,
      },
      select: { id: true },
    });
    if (!activePic) {
      return NextResponse.json(
        errorResponse("Akun PIC atau unit kerja tidak aktif", 403),
        { status: 403 },
      );
    }
    const {
      activityName,
      programId: targetProgramId,
      tanggalKegiatan,
      lokasi,
      description,
      photos,
    } = parsedData.data;
    // UPDATED: Validasi server jaminan 1-2 foto (Blocker 5)
    if (photos !== undefined) {
      if (photos.length < 1 || photos.length > 2) {
        return NextResponse.json(
          errorResponse(
            "Jumlah foto dokumentasi wajib antara 1 hingga 2 foto",
            400,
          ),
          { status: 400 },
        );
      }
    } else if (
      existingReport.photos.length < 1 ||
      existingReport.photos.length > 2
    ) {
      return NextResponse.json(
        errorResponse(
          "Laporan harus memiliki 1 hingga 2 foto dokumentasi",
          400,
        ),
        { status: 400 },
      );
    }
    const finalProgramId = targetProgramId || existingReport.programId;
    if (!finalProgramId) {
      return NextResponse.json(errorResponse("Program ID wajib diisi", 400), {
        status: 400,
      });
    }
    const programData = await prisma.programBudaya.findUnique({
      where: { id: finalProgramId },
      include: { category: true },
    });
    if (!programData || !programData.category) {
      return NextResponse.json(errorResponse("Program tidak ditemukan", 404), {
        status: 404,
      });
    }
    if (!programData.isActive) {
      return NextResponse.json(
        errorResponse("Program sedang tidak aktif", 400),
        {
          status: 400,
        },
      );
    }
    const capabilityError = getCapabilityError(programData.category);
    if (capabilityError) {
      return NextResponse.json(
        errorResponse(capabilityError, 422),
        { status: 422 },
      );
    }
    if (!requiresEvidence(programData.category)) {
      return NextResponse.json(
        errorResponse("Program ini tidak menerima unggahan bukti foto", 422),
        { status: 422 },
      );
    }
    if (!isProgramUploadOpen(programData)) {
      return NextResponse.json(
        errorResponse("Jendela upload program sedang tertutup", 403),
        { status: 403 },
      );
    }
    const finalDate = tanggalKegiatan
      ? new Date(tanggalKegiatan)
      : existingReport.tanggalKegiatan;
    if (!isActivityDateInsideProgram(finalDate, programData)) {
      return NextResponse.json(
        errorResponse("Tanggal kegiatan di luar periode program", 400),
        { status: 400 },
      );
    }
    const category = programData.category;

    // UPDATED: Transaksi atomik dengan duplicate direct-admin check pada resubmit (Blocker 4)
    const [updatedReport] = await prisma.$transaction(async (tx) => {
      if (category.scoreInputMode === "DIRECT_ADMIN") {
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`direct-report:${existingReport.unitId}:${finalProgramId}`}))::text`,
        );
        const duplicateOtherReport = await tx.activityReport.findFirst({
          where: {
            id: { not: id },
            unitId: existingReport.unitId,
            programId: finalProgramId,
          },
          select: { id: true },
        });
        if (duplicateOtherReport) {
          throw new ApiError(
            "Unit Anda sudah memiliki laporan lain untuk program penilaian ini",
            409,
          );
        }
      }
      if (photos && photos.length > 0) {
        await tx.activityPhoto.deleteMany({ where: { reportId: id } });
      }
      const reportUpdated = await tx.activityReport.update({
        where: { id },
        data: {
          activityName,
          programId: finalProgramId,
          tanggalKegiatan: finalDate,
          lokasi,
          description,
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
      });
      await tx.activityLog.create({
        data: {
          reportId: id,
          action: "RESUBMITTED",
          notes: null,
          actorId: session.user.id,
          actorName: session.user.name,
          actorRole: session.user.role,
        },
      });
      return [reportUpdated];
    });

    if (photos && photos.length > 0) {
      for (const photo of existingReport.photos) {
        if (photo.publicId && !photo.imageUrl.startsWith("http")) {
          try {
            await unlink(
              path.join(process.cwd(), "public", "uploads", photo.publicId),
            );
          } catch {
            // The database update succeeded; leave an orphaned local file for cleanup.
          }
        }
      }
    }

    return NextResponse.json(
      successResponse(updatedReport, "Laporan berhasil diperbarui"),
      {
        status: 200,
      },
    );
  } catch (error) {
    return handleApiError(error, "PUT /api/reports/[id]");
  }
}
