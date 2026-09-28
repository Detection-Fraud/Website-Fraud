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
import {
  getCapabilityError,
  requiresEvidence,
} from "@/lib/program-capabilities";
import { errorResponse, formatZodError, successResponse } from "@/lib/response";
import {
  UploadLifecycleError,
  captureActivityPhotoOwner,
  capturePersistedOldCleanup,
  cleanupPersistedOldUploadAfterCommit,
  createServerOwnedUploadContext,
  findUploadReferences,
  getUploadLifecycleTransaction,
  matchesExpectedUpdatedAt,
  parseExpectedUpdatedAt,
  readVerifiedNewUpload,
  rollbackVerifiedNewUpload,
  verifyNewUpload,
  withUploadLifecycleTransaction,
  type PersistedOldCleanup,
  type VerifiedNewUpload,
} from "@/lib/api/upload-lifecycle";
import { classifyStorageKey, resolveUploadReference } from "@/lib/api/upload-storage";
import { updateReportSchema } from "@/schemas/report.schema";
import { Prisma } from "@generated/prisma";
import { NextRequest, NextResponse } from "next/server";

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
  photos: {
    select: { id: true, originalName: true, imageUrl: true },
  },
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
        ...(user.role === "PIC" && user.unitType !== "KANTOR_WILAYAH" && {
          createdById: user.id,
        }),
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
  const verifiedUploads: VerifiedNewUpload[] = [];

  try {
    const session = await requirePic();
    const { id } = await params;
    const body = await req.json();
    const parsedData = updateReportSchema.safeParse(body);
    if (!parsedData.success) {
      const errorMessage = formatZodError(parsedData.error);
      return NextResponse.json(
        errorResponse("Validasi gagal: " + errorMessage, 400),
        { status: 400 },
      );
    }

    const { expectedUpdatedAt, photos } = parsedData.data;
    const expectedVersion = parseExpectedUpdatedAt(expectedUpdatedAt);
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
        errorResponse("Hanya pengunggah asli yang dapat memperbarui laporan ini", 403),
        { status: 403 },
      );
    }
    if (existingReport.status !== "REJECTED") {
      return NextResponse.json(
        errorResponse("Hanya laporan dengan status ditolak yang dapat diedit", 409),
        { status: 409 },
      );
    }
    if (!session.user.unitId || session.user.unitId !== existingReport.unitId) {
      return NextResponse.json(
        errorResponse("Anda tidak memiliki akses ke unit laporan ini", 403),
        { status: 403 },
      );
    }
    if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existingReport.updatedAt)) {
      return NextResponse.json(
        errorResponse("Laporan telah berubah. Muat ulang sebelum mengirim ulang.", 409),
        { status: 409 },
      );
    }

    const activePic = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        isActive: true,
        unitId: existingReport.unitId,
      },
      select: { id: true },
    });
    if (!activePic) {
      return NextResponse.json(
        errorResponse("Akun PIC atau unit kerja tidak aktif", 403),
        { status: 403 },
      );
    }

    if (photos === undefined && (existingReport.photos.length < 1 || existingReport.photos.length > 2)) {
      return NextResponse.json(
        errorResponse("Laporan harus memiliki 1 hingga 2 foto dokumentasi", 400),
        { status: 400 },
      );
    }

    const targetProgramId = parsedData.data.programId ?? existingReport.programId;
    if (!targetProgramId) {
      return NextResponse.json(errorResponse("Program ID wajib diisi", 400), {
        status: 400,
      });
    }

    const managedOldPhotos = photos === undefined
      ? []
      : existingReport.photos.flatMap((photo) => {
          const publicId = photo.publicId ?? "";
          const imageKey = photo.imageUrl.startsWith("/uploads/")
            ? photo.imageUrl.slice("/uploads/".length)
            : "";
          const key = classifyStorageKey(publicId) === "report"
            ? publicId
            : classifyStorageKey(imageKey) === "report"
              ? imageKey
              : null;
          return key && key.startsWith("reports/" + existingReport.unitId + "/")
            ? [{ photo, key, field: key === publicId ? "publicId" as const : "imageUrl" as const }]
            : [];
        });
    const candidateIds = photos?.map((photo) => photo.publicId) ?? [];
    if (new Set(candidateIds).size !== candidateIds.length) {
      return NextResponse.json(
        errorResponse("Foto yang sama tidak dapat dipakai lebih dari sekali", 400),
        { status: 400 },
      );
    }

    const finalFields = {
      activityName: parsedData.data.activityName ?? existingReport.activityName,
      programId: targetProgramId,
      tanggalKegiatan: parsedData.data.tanggalKegiatan ?? existingReport.tanggalKegiatan,
      lokasi: parsedData.data.lokasi ?? existingReport.lokasi,
      description: parsedData.data.description ?? existingReport.description,
    };
    const entities = [
      { model: "ActivityReport", id },
      { model: "ProgramBudaya", id: targetProgramId },
      { model: "Unit", id: existingReport.unitId },
      ...(photos === undefined
        ? []
        : existingReport.photos.map((photo) => ({
            model: "ActivityPhoto",
            id: String(photo.id),
          }))),
    ];
    const fileKeys = [
      ...managedOldPhotos.map(({ key }) => key),
      ...candidateIds,
    ];
    const oldCleanup: PersistedOldCleanup[] = [];

    const updatedReport = await withUploadLifecycleTransaction(
      prisma,
      { entities, fileKeys },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        const lockedReport = await tx.activityReport.findUnique({
          where: { id },
          include: { photos: true },
        });
        if (!lockedReport) throw new ApiError("Laporan tidak ditemukan", 404);
        if (lockedReport.createdById !== session.user.id) {
          throw new ApiError("Hanya pengunggah asli yang dapat memperbarui laporan ini", 403);
        }
        if (!lockedReport.unitId || lockedReport.unitId !== session.user.unitId) {
          throw new ApiError("Anda tidak memiliki akses ke unit laporan ini", 403);
        }
        if (lockedReport.status !== "REJECTED") {
          throw new ApiError("Hanya laporan dengan status ditolak yang dapat diedit", 409);
        }
        if (!matchesExpectedUpdatedAt(expectedUpdatedAt, lockedReport.updatedAt)) {
          throw new ApiError("Laporan telah berubah. Muat ulang sebelum mengirim ulang.", 409);
        }

        const lockedPic = await tx.user.findFirst({
          where: {
            id: session.user.id,
            isActive: true,
            unitId: lockedReport.unitId,
          },
          select: { id: true },
        });
        if (!lockedPic) throw new ApiError("Akun PIC atau unit kerja tidak aktif", 403);

        if (photos !== undefined) {
          const snapshot = (rows: typeof existingReport.photos) =>
            JSON.stringify(
              rows
                .map(({ id: photoId, imageUrl, publicId }) => ({
                  photoId,
                  imageUrl,
                  publicId,
                }))
                .sort((left, right) => left.photoId - right.photoId),
            );
          if (snapshot(lockedReport.photos) !== snapshot(existingReport.photos)) {
            throw new ApiError(
              "Foto laporan telah berubah. Muat ulang sebelum mengirim ulang.",
              409,
            );
          }
        }

        if (
          photos === undefined &&
          (lockedReport.photos.length < 1 || lockedReport.photos.length > 2)
        ) {
          throw new ApiError("Laporan harus memiliki 1 hingga 2 foto dokumentasi", 400);
        }

        const targetProgram = await tx.programBudaya.findUnique({
          where: { id: targetProgramId },
          include: { category: true },
        });
        if (!targetProgram || !targetProgram.category) {
          throw new ApiError("Program tidak ditemukan", 404);
        }
        if (!targetProgram.isActive) throw new ApiError("Program sedang tidak aktif", 400);
        const capabilityError = getCapabilityError(targetProgram.category);
        if (capabilityError) throw new ApiError(capabilityError, 422);
        if (!requiresEvidence(targetProgram.category)) {
          throw new ApiError("Program ini tidak menerima unggahan bukti foto", 422);
        }
        if (!isProgramUploadOpen(targetProgram)) {
          throw new ApiError("Jendela upload program sedang tertutup", 403);
        }
        if (!isActivityDateInsideProgram(finalFields.tanggalKegiatan, targetProgram)) {
          throw new ApiError("Tanggal kegiatan di luar periode program", 400);
        }

        if (targetProgram.category.scoreInputMode === "DIRECT_ADMIN") {
          const duplicateReport = await tx.activityReport.findFirst({
            where: {
              id: { not: id },
              unitId: lockedReport.unitId,
              programId: targetProgramId,
            },
            select: { id: true },
          });
          if (duplicateReport) {
            throw new ApiError(
              "Unit Anda sudah memiliki laporan lain untuk program penilaian ini",
              409,
            );
          }
        }

        const uploaded: { originalName: string; imageUrl: string; publicId: string }[] = [];
        for (const photo of photos ?? []) {
          const context = createServerOwnedUploadContext({
            userId: session.user.id,
            purpose: "EVIDENCE",
            mode: "REPLACEMENT",
            publicId: photo.publicId,
            unitId: lockedReport.unitId,
            reportId: id,
          });
          const handle = verifyNewUpload(photo.descriptor, photo.cleanupToken, context);
          verifiedUploads.push(handle);
          const state = readVerifiedNewUpload(handle);
          const resolved = await resolveUploadReference(state.url);
          if (
            resolved.kind !== "local" ||
            !resolved.exists ||
            !resolved.isRegularFile ||
            resolved.storageKey !== state.publicId
          ) {
            throw new ApiError("File foto tidak tersedia atau tidak valid", 400);
          }
          if ((await findUploadReferences(lifecycle, state.publicId)).length > 0) {
            throw new ApiError("File foto telah digunakan oleh laporan lain", 409);
          }
          uploaded.push({
            originalName: photo.originalName,
            imageUrl: state.url,
            publicId: state.publicId,
          });
        }

        for (const oldPhoto of lockedReport.photos) {
          const old = managedOldPhotos.find(({ photo }) => photo.id === oldPhoto.id);
          if (!old) continue;
          const owner = await captureActivityPhotoOwner(
            lifecycle,
            { id: oldPhoto.id, expectedReportId: id },
            old.field,
          );
          oldCleanup.push(capturePersistedOldCleanup(lifecycle, owner));
        }

        const submittedAt = new Date();
        const transition = await tx.activityReport.updateMany({
          where: {
            id,
            status: "REJECTED",
            updatedAt: expectedVersion,
          },
          data: {
            status: "PENDING",
            notes: null,
            lastSubmittedAt: submittedAt,
            updatedAt: submittedAt,
          },
        });
        if (transition.count !== 1) {
          throw new ApiError("Laporan telah berubah. Muat ulang sebelum mengirim ulang.", 409);
        }

        if (photos !== undefined) {
          await tx.activityPhoto.deleteMany({ where: { reportId: id } });
        }
        const reportUpdated = await tx.activityReport.update({
          where: { id },
          data: {
            ...finalFields,
            updatedAt: submittedAt,
            ...(photos !== undefined
              ? {
                  photos: {
                    create: uploaded,
                  },
                }
              : {}),
          },
        });
        await tx.activityLog.create({
          data: {
            reportId: id,
            action: "RESUBMITTED",
            createdAt: submittedAt,
            notes: null,
            actorId: session.user.id,
            actorName: session.user.name,
            actorRole: session.user.role,
          },
        });
        return reportUpdated;
      },
    );

    const cleanupResults = await Promise.allSettled(
      oldCleanup.map((cleanup) =>
        cleanupPersistedOldUploadAfterCommit(prisma, cleanup),
      ),
    );
    for (const result of cleanupResults) {
      if (result.status === "rejected") {
        console.error("Gagal menjalankan cleanup file lama setelah resubmit");
      } else if (result.value.kind === "failed") {
        console.error("Gagal membersihkan file lama setelah resubmit", result.value.fileKey);
      }
    }

    return NextResponse.json(
      successResponse(updatedReport, "Laporan berhasil diperbarui"),
      { status: 200 },
    );
  } catch (error) {
    await Promise.allSettled(
      verifiedUploads.map((upload) => rollbackVerifiedNewUpload(prisma, upload)),
    );
    if (error instanceof UploadLifecycleError) {
      return NextResponse.json(
        errorResponse("Upload foto tidak valid atau tidak dapat diproses", 400),
        { status: 400 },
      );
    }
    return handleApiError(error, "PUT /api/reports/[id]");
  }
}
