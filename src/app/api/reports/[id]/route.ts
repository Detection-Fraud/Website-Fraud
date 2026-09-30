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
import { updateReportSchema } from "@/schemas/report.schema";
import { Prisma } from "@generated/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
  captureActivityPhotoOwner,
  capturePersistedOldCleanup,
  cleanupPersistedOldUploadAfterCommit,
  createServerOwnedUploadContext,
  findUploadReferences,
  getUploadLifecycleTransaction,
  matchesExpectedUpdatedAt,
  parseExpectedUpdatedAt,
  readPersistedOldCleanup,
  readVerifiedNewUpload,
  rollbackVerifiedNewUpload,
  UploadLifecycleError,
  verifyNewUpload,
  withUploadLifecycleTransaction,
  type PersistedOldCleanup,
  type VerifiedNewUpload,
} from "@/lib/api/upload-lifecycle";
import {
  classifyManagedStorageKey,
  classifyUploadReference,
  resolveUploadReference,
} from "@/lib/api/upload-storage";

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

async function cleanupOldUploadsAfterCommit(cleanups: PersistedOldCleanup[]): Promise<void> {
  const results = await Promise.allSettled(
    cleanups.map((cleanup) => cleanupPersistedOldUploadAfterCommit(prisma, cleanup)),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected" || result.value.kind === "failed") {
      console.error("[PUT /api/reports/[id]] upload cleanup failed", {
        phase: "post-commit-old-file",
        fileKey: readPersistedOldCleanup(cleanups[index]).fileKey,
      });
    }
  });
}

async function rollbackRequestUploads(uploads: VerifiedNewUpload[]): Promise<void> {
  const results = await Promise.allSettled(
    uploads.map((upload) => rollbackVerifiedNewUpload(prisma, upload)),
  );
  results.forEach((result, index) => {
    if (result.status === "rejected" || result.value.kind === "failed") {
      console.error("[PUT /api/reports/[id]] upload cleanup failed", {
        phase: "rollback-new-upload",
        fileKey: readVerifiedNewUpload(uploads[index]).publicId,
      });
    }
  });
}

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
      where: scopeWhere,
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
    const parsedData = updateReportSchema.safeParse(await req.json());
    if (!parsedData.success) {
      return NextResponse.json(
        errorResponse(`Validasi gagal: ${formatZodError(parsedData.error)}`, 400),
        { status: 400 },
      );
    }

    const expectedUpdatedAt = parseExpectedUpdatedAt(parsedData.data.expectedUpdatedAt);
    const existingReport = await prisma.activityReport.findUnique({
      where: { id },
      include: { photos: true },
    });
    if (!existingReport) {
      return NextResponse.json(errorResponse("Laporan tidak ditemukan", 404), { status: 404 });
    }
    if (existingReport.createdById !== session.user.id) {
      return NextResponse.json(errorResponse("Hanya pengunggah asli yang dapat memperbarui laporan ini", 403), { status: 403 });
    }
    const reportUnitId = existingReport.unitId;
    if (!session.user.unitId || !reportUnitId || session.user.unitId !== reportUnitId) {
      return NextResponse.json(errorResponse("Anda tidak memiliki akses ke unit laporan ini", 403), { status: 403 });
    }
    if (existingReport.status !== "REJECTED") {
      return NextResponse.json(errorResponse("Hanya laporan dengan status ditolak yang dapat diedit", 409), { status: 409 });
    }
    if (!matchesExpectedUpdatedAt(parsedData.data.expectedUpdatedAt, existingReport.updatedAt)) {
      return NextResponse.json(errorResponse("Laporan sudah berubah. Muat ulang sebelum mengirim kembali", 409), { status: 409 });
    }

    const activePic = await prisma.user.findFirst({
      where: { id: session.user.id, isActive: true, unitId: existingReport.unitId },
      select: { id: true, unitId: true },
    });
    if (!activePic) {
      return NextResponse.json(errorResponse("Akun PIC atau unit kerja tidak aktif", 403), { status: 403 });
    }

    const { activityName, programId: targetProgramId, tanggalKegiatan, lokasi, description, photos } = parsedData.data;
    if (photos !== undefined) {
      if (photos.length < 1 || photos.length > 2) {
        return NextResponse.json(errorResponse("Jumlah foto dokumentasi wajib antara 1 hingga 2 foto", 400), { status: 400 });
      }
    } else if (existingReport.photos.length < 1 || existingReport.photos.length > 2) {
      return NextResponse.json(errorResponse("Laporan harus memiliki 1 hingga 2 foto dokumentasi", 400), { status: 400 });
    }

    const finalProgramId = targetProgramId || existingReport.programId;
    if (!finalProgramId) {
      return NextResponse.json(errorResponse("Program ID wajib diisi", 400), { status: 400 });
    }
    const finalDate = tanggalKegiatan ? new Date(tanggalKegiatan) : existingReport.tanggalKegiatan;

    const seen = new Set<string>();
    const uploadStates: Array<{ originalName: string; publicId: string; url: string; descriptor: string; cleanupToken: string }> = [];
    for (const photo of photos ?? []) {
      if (seen.has(photo.publicId)) throw new ApiError("Foto upload duplikat", 400);
      seen.add(photo.publicId);

      const context = createServerOwnedUploadContext({
        userId: session.user.id,
        purpose: "EVIDENCE",
        mode: "REPLACEMENT",
        publicId: photo.publicId,
      unitId: reportUnitId,
        reportId: id,
      });
      const verified = verifyNewUpload(photo.descriptor, photo.cleanupToken, context);
      verifiedUploads.push(verified);
      const state = readVerifiedNewUpload(verified);
      const resolved = await resolveUploadReference(state.url);
      if (state.publicId !== photo.publicId || resolved.kind !== "local" || !resolved.exists || !resolved.isRegularFile || resolved.storageKey !== state.publicId) {
        throw new ApiError("File upload tidak tersedia", 400);
      }
      uploadStates.push({
        originalName: photo.originalName,
        publicId: state.publicId,
        url: state.url,
        descriptor: photo.descriptor,
        cleanupToken: photo.cleanupToken,
      });
    }

    const programData = await prisma.programBudaya.findUnique({ where: { id: finalProgramId }, include: { category: true } });
    if (!programData?.category) throw new ApiError("Program tidak ditemukan", 404);
    if (!programData.isActive) throw new ApiError("Program sedang tidak aktif", 400);
    const capabilityError = getCapabilityError(programData.category);
    if (capabilityError) throw new ApiError(capabilityError, 422);
    if (!requiresEvidence(programData.category)) throw new ApiError("Program ini tidak menerima unggahan bukti foto", 422);
    if (!isProgramUploadOpen(programData)) throw new ApiError("Jendela upload program sedang tertutup", 403);
    if (!isActivityDateInsideProgram(finalDate, programData)) throw new ApiError("Tanggal kegiatan di luar periode program", 400);

    const managedOldKeys = new Set<string>();
    for (const photo of existingReport.photos) {
      const image = classifyUploadReference(photo.imageUrl);
      if (image.kind === "local" && classifyManagedStorageKey(image.storageKey)) managedOldKeys.add(image.storageKey);
      if (photo.publicId && classifyManagedStorageKey(photo.publicId)) managedOldKeys.add(photo.publicId);
    }
    const lifecycleEntities = [
      { model: "ActivityReport", id },
      { model: "ProgramBudaya", id: finalProgramId },
      ...(existingReport.programId && existingReport.programId !== finalProgramId
        ? [{ model: "ProgramBudaya", id: existingReport.programId }]
        : []),
      { model: "Unit", id: reportUnitId },
      ...existingReport.photos
        .filter((photo) => {
          const image = classifyUploadReference(photo.imageUrl);
          return (image.kind === "local" && classifyManagedStorageKey(image.storageKey)) || Boolean(photo.publicId && classifyManagedStorageKey(photo.publicId));
        })
        .map((photo) => ({ model: "ActivityPhoto", id: String(photo.id) })),
    ];

    const result = await withUploadLifecycleTransaction<{
      updatedReport: Prisma.ActivityReportGetPayload<Record<string, never>>;
      oldCleanups: PersistedOldCleanup[];
    }>(
      prisma,
      {
        entities: lifecycleEntities,
        fileKeys: [...managedOldKeys, ...uploadStates.map(({ publicId }) => publicId)],
      },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        const lockedReport = await tx.activityReport.findUnique({ where: { id }, include: { photos: true } });
        if (!lockedReport) throw new ApiError("Laporan tidak ditemukan", 404);
        const lockedUnitId = lockedReport.unitId;
        if (lockedReport.createdById !== session.user.id || !lockedUnitId || lockedUnitId !== reportUnitId) {
          throw new ApiError("Anda tidak memiliki akses ke unit laporan ini", 403);
        }
        if (lockedReport.status !== "REJECTED") throw new ApiError("Laporan sudah berubah status", 409);
        if (lockedReport.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
          throw new ApiError("Laporan sudah berubah. Muat ulang sebelum mengirim kembali", 409);
        }
        const snapshot = (rows: typeof existingReport.photos) => rows.map(({ id: photoId, imageUrl, publicId, originalName }) => ({ photoId, imageUrl, publicId, originalName }));
        if (JSON.stringify(snapshot(lockedReport.photos)) !== JSON.stringify(snapshot(existingReport.photos))) {
          throw new ApiError("Foto laporan sudah berubah. Muat ulang sebelum mengirim kembali", 409);
        }

        const lockedPic = await tx.user.findFirst({ where: { id: session.user.id, isActive: true, unitId: lockedUnitId }, select: { id: true } });
        if (!lockedPic) throw new ApiError("Akun PIC atau unit kerja tidak aktif", 403);
        const lockedProgram = await tx.programBudaya.findUnique({ where: { id: finalProgramId }, include: { category: true } });
        if (!lockedProgram?.category) throw new ApiError("Program tidak ditemukan", 404);
        if (!lockedProgram.isActive) throw new ApiError("Program sedang tidak aktif", 400);
        const lockedCapabilityError = getCapabilityError(lockedProgram.category);
        if (lockedCapabilityError) throw new ApiError(lockedCapabilityError, 422);
        if (!requiresEvidence(lockedProgram.category)) throw new ApiError("Program ini tidak menerima unggahan bukti foto", 422);
        if (!isProgramUploadOpen(lockedProgram)) throw new ApiError("Jendela upload program sedang tertutup", 403);
        if (!isActivityDateInsideProgram(finalDate, lockedProgram)) throw new ApiError("Tanggal kegiatan di luar periode program", 400);

        for (const photo of uploadStates) {
          if ((await findUploadReferences(lifecycle, photo.publicId)).length > 0) throw new ApiError("File upload sudah digunakan", 409);
          const context = createServerOwnedUploadContext({
            userId: session.user.id,
            purpose: "EVIDENCE",
            mode: "REPLACEMENT",
            publicId: photo.publicId,
            unitId: lockedUnitId,
            reportId: id,
          });
          const verified = verifyNewUpload(photo.descriptor, photo.cleanupToken, context);
          const state = readVerifiedNewUpload(verified);
          const resolved = await resolveUploadReference(state.url);
          if (state.publicId !== photo.publicId || state.url !== photo.url || resolved.kind !== "local" || !resolved.exists || !resolved.isRegularFile || resolved.storageKey !== state.publicId) {
            throw new ApiError("File upload tidak tersedia", 400);
          }
        }

        if (lockedProgram.category.scoreInputMode === "DIRECT_ADMIN") {
          const duplicate = await tx.activityReport.findFirst({
            where: { id: { not: id }, unitId: lockedUnitId, programId: finalProgramId },
            select: { id: true },
          });
          if (duplicate) throw new ApiError("Unit Anda sudah memiliki laporan lain untuk program penilaian ini", 409);
        }

        const resubmittedAt = new Date();
        const transition = await tx.activityReport.updateMany({
          where: { id, status: "REJECTED", updatedAt: expectedUpdatedAt },
          data: { status: "PENDING", notes: null, lastSubmittedAt: resubmittedAt, updatedAt: resubmittedAt },
        });
        if (transition.count !== 1) throw new ApiError("Laporan tidak ditemukan atau statusnya sudah berubah", 409);

        const oldCleanups: PersistedOldCleanup[] = [];
        if (photos !== undefined) {
          for (const oldPhoto of lockedReport.photos) {
            const image = classifyUploadReference(oldPhoto.imageUrl);
            if (image.kind === "local" && classifyManagedStorageKey(image.storageKey)) {
              const owner = await captureActivityPhotoOwner(lifecycle, { id: oldPhoto.id, expectedReportId: id }, "imageUrl");
              oldCleanups.push(capturePersistedOldCleanup(lifecycle, owner));
            }
            if (oldPhoto.publicId && classifyManagedStorageKey(oldPhoto.publicId)) {
              const imageKey = image.kind === "local" ? image.storageKey : undefined;
              if (oldPhoto.publicId !== imageKey) {
                const owner = await captureActivityPhotoOwner(lifecycle, { id: oldPhoto.id, expectedReportId: id }, "publicId");
                oldCleanups.push(capturePersistedOldCleanup(lifecycle, owner));
              }
            }
          }
          await tx.activityPhoto.deleteMany({ where: { reportId: id } });
        }

        const updatedReport = await tx.activityReport.update({
          where: { id },
          data: {
            ...(activityName !== undefined ? { activityName } : {}),
            programId: finalProgramId,
            tanggalKegiatan: finalDate,
            ...(lokasi !== undefined ? { lokasi } : {}),
            ...(description !== undefined ? { description } : {}),
            updatedAt: resubmittedAt,
            ...(photos !== undefined ? { photos: { create: uploadStates.map(({ originalName, publicId, url }) => ({ originalName, publicId, imageUrl: url })) } } : {}),
          },
        });
        await tx.activityLog.create({
          data: {
            reportId: id,
            action: "RESUBMITTED",
            createdAt: resubmittedAt,
            notes: null,
            actorId: session.user.id,
            actorName: session.user.name,
            actorRole: session.user.role,
          },
        });
        return { updatedReport, oldCleanups };
      },
    );

    await cleanupOldUploadsAfterCommit(result.oldCleanups);
    return NextResponse.json(successResponse(result.updatedReport, "Laporan berhasil diperbarui"), { status: 200 });
  } catch (error) {
    if (error instanceof UploadLifecycleError) {
      await rollbackRequestUploads(verifiedUploads);
      return NextResponse.json(errorResponse("Data upload tidak valid", 400), { status: 400 });
    }
    if (verifiedUploads.length > 0) {
      await rollbackRequestUploads(verifiedUploads);
    }
    return handleApiError(error, "PUT /api/reports/[id]");
  }
}
