import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import {
  capturePersistedOldCleanup,
  captureProgramBudayaOwner,
  cleanupPersistedOldUploadAfterCommit,
  createServerOwnedUploadContext,
  findUploadReferences,
  getUploadLifecycleTransaction,
  matchesExpectedUpdatedAt,
  parseExpectedUpdatedAt,
  readVerifiedNewUpload,
  rollbackVerifiedNewUpload,
  UploadLifecycleError,
  verifyNewUpload,
  withUploadLifecycleTransaction,
} from "@/lib/api/upload-lifecycle";
import { classifyManagedStorageKey, classifyUploadReference, resolveUploadReference } from "@/lib/api/upload-storage";
import { prisma } from "@/lib/prisma";
import { getCapabilityError, usesDirectAdminScore } from "@/lib/program-capabilities";
import { errorResponse, successResponse } from "@/lib/response";
import { createProgramSchema, updateProgramSchema } from "@/schemas/program.schema";
import { Prisma } from "@generated/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateProgramRequestSchema = z.intersection(updateProgramSchema, z.object({
  expectedUpdatedAt: z.string(),
  bannerState: z.enum(["UNCHANGED", "REPLACED", "REMOVED", "NONE"]),
  bannerPublicId: z.string().optional(),
  bannerDescriptor: z.string().optional(),
  bannerCleanupToken: z.string().optional(),
}));

const toggleProgramRequestSchema = z.object({
  isActive: z.boolean(),
  expectedUpdatedAt: z.string(),
});

function uploadKeyFromBanner(value: string | null | undefined): string | null {
  if (!value) return null;
  const reference = classifyUploadReference(value);
  if (reference.kind !== "local") return null;
  return classifyManagedStorageKey(reference.storageKey) === "banner-programs"
    ? reference.storageKey
    : null;
}

async function cleanupOldBanner(cleanup: ReturnType<typeof capturePersistedOldCleanup> | undefined) {
  if (!cleanup) return;
  const result = await cleanupPersistedOldUploadAfterCommit(prisma, cleanup);
  if (result.kind === "failed") {
    console.error("Gagal membersihkan banner program lama", result.fileKey);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireAdmin();
    const parsed = toggleProgramRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(errorResponse("Validasi input gagal", 400, z.treeifyError(parsed.error)), { status: 400 });
    }
    const expectedVersion = parseExpectedUpdatedAt(parsed.data.expectedUpdatedAt);
    const updated = await withUploadLifecycleTransaction(
      prisma,
      { entities: [{ model: "ProgramBudaya", id }], fileKeys: [] },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        const current = await tx.programBudaya.findUnique({ where: { id } });
        if (!current) throw new ApiError("Program tidak ditemukan", 404);
        if (!matchesExpectedUpdatedAt(parsed.data.expectedUpdatedAt, current.updatedAt)) {
          throw new ApiError("Program telah berubah. Muat ulang sebelum menyimpan.", 409);
        }
        const result = await tx.programBudaya.updateMany({
          where: { id, updatedAt: expectedVersion },
          data: { isActive: parsed.data.isActive },
        });
        if (result.count !== 1) throw new ApiError("Program telah berubah. Muat ulang sebelum menyimpan.", 409);
        return tx.programBudaya.findUnique({ where: { id } });
      },
    );
    const statusText = parsed.data.isActive ? "diaktifkan" : "dinonaktifkan";
    return NextResponse.json(successResponse(updated, `Program ${statusText} berhasil`), { status: 200 });
  } catch (error) {
    if (error instanceof UploadLifecycleError) return NextResponse.json(errorResponse("Perubahan program tidak dapat diproses", 400), { status: 400 });
    return handleApiError(error, "PATCH /api/programs/[id]");
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const verifiedUploads: ReturnType<typeof verifyNewUpload>[] = [];
  try {
    const { id } = await params;
    const session = await requireAdmin();
    const parsed = updateProgramRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(errorResponse("Validasi input gagal", 400, z.treeifyError(parsed.error)), { status: 400 });
    }
    const expectedVersion = parseExpectedUpdatedAt(parsed.data.expectedUpdatedAt);
    const {
      expectedUpdatedAt, bannerState, bannerPublicId, bannerDescriptor,
      bannerCleanupToken, ...fields
    } = parsed.data;
    const existingProgram = await prisma.programBudaya.findUnique({ where: { id } });
    if (!existingProgram) return NextResponse.json(errorResponse("Program tidak ditemukan", 404), { status: 404 });

    let replacement: ReturnType<typeof verifyNewUpload> | undefined;
    if (bannerState === "REPLACED") {
      if (!bannerPublicId || !bannerDescriptor || !bannerCleanupToken) throw new ApiError("Bukti upload banner tidak lengkap", 400);
      replacement = verifyNewUpload(
        bannerDescriptor,
        bannerCleanupToken,
        createServerOwnedUploadContext({
          userId: session.user.id,
          purpose: "PROGRAM_BANNER",
          mode: "REPLACEMENT",
          publicId: bannerPublicId,
        }),
      );
      verifiedUploads.push(replacement);
    } else if (bannerPublicId || bannerDescriptor || bannerCleanupToken) {
      throw new ApiError("Bukti upload banner tidak sesuai", 400);
    }

    const initialValidation = createProgramSchema.safeParse({
      name: fields.name ?? existingProgram.name,
      description: fields.description !== undefined ? fields.description : existingProgram.description,
      bannerUrl: existingProgram.bannerUrl,
      frequency: fields.frequency ?? existingProgram.frequency,
      tw: fields.tw !== undefined ? fields.tw : existingProgram.tw,
      startDate: fields.startDate ?? existingProgram.startDate,
      endDate: fields.endDate ?? existingProgram.endDate,
      uploadDeadline: fields.uploadDeadline ?? existingProgram.uploadDeadline,
      categoryId: fields.categoryId !== undefined ? fields.categoryId : existingProgram.categoryId,
    });
    if (!initialValidation.success) return NextResponse.json(errorResponse("Validasi input gagal", 400, z.treeifyError(initialValidation.error)), { status: 400 });

    const initialOldKey = uploadKeyFromBanner(existingProgram.bannerUrl);
    const newUpload = replacement ? readVerifiedNewUpload(replacement) : undefined;
    const requestedCategoryId = fields.categoryId !== undefined
      ? fields.categoryId
      : existingProgram.categoryId;
    const oldCleanup: Array<ReturnType<typeof capturePersistedOldCleanup>> = [];
    const updatedProgram = await withUploadLifecycleTransaction(
      prisma,
      {
        entities: [
          { model: "ProgramBudaya", id },
          ...[...new Set([existingProgram.categoryId, requestedCategoryId])]
            .filter((categoryId): categoryId is string => categoryId !== null)
            .map((categoryId) => ({ model: "ProgramCategory", id: categoryId })),
        ],
        fileKeys: [...(initialOldKey ? [initialOldKey] : []), ...(newUpload ? [newUpload.publicId] : [])],
      },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        const current = await tx.programBudaya.findUnique({ where: { id } });
        if (!current) throw new ApiError("Program tidak ditemukan", 404);
        if (!matchesExpectedUpdatedAt(expectedUpdatedAt, current.updatedAt)) throw new ApiError("Program telah berubah. Muat ulang sebelum menyimpan.", 409);
        if (current.bannerUrl !== existingProgram.bannerUrl) throw new ApiError("Banner program telah berubah. Muat ulang sebelum menyimpan.", 409);
        if (current.categoryId !== existingProgram.categoryId) throw new ApiError("Kategori program telah berubah. Muat ulang sebelum menyimpan.", 409);

        const merged = createProgramSchema.safeParse({
          name: fields.name ?? current.name,
          description: fields.description !== undefined ? fields.description : current.description,
          bannerUrl: current.bannerUrl,
          frequency: fields.frequency ?? current.frequency,
          tw: fields.tw !== undefined ? fields.tw : current.tw,
          startDate: fields.startDate ?? current.startDate,
          endDate: fields.endDate ?? current.endDate,
          uploadDeadline: fields.uploadDeadline ?? current.uploadDeadline,
          categoryId: fields.categoryId !== undefined ? fields.categoryId : current.categoryId,
        });
        if (!merged.success) throw new ApiError("Validasi input gagal", 400);
        const values = merged.data;

        if (values.categoryId !== current.categoryId) {
          const reports = await tx.activityReport.count({ where: { programId: id } });
          if (reports > 0) throw new ApiError("Kategori program tidak dapat diubah karena sudah memiliki laporan kegiatan", 409);
        }
        const conflictCount = await tx.activityReport.count({
          where: { programId: id, OR: [{ tanggalKegiatan: { lt: values.startDate } }, { tanggalKegiatan: { gt: values.endDate } }] },
        });
        if (conflictCount > 0) throw new ApiError(`Rentang baru bertabrakan dengan ${conflictCount} laporan lama`, 409);

        let bannerUrl = current.bannerUrl;
        if (bannerState === "REMOVED") bannerUrl = null;
        if (bannerState === "REPLACED") {
          if (!newUpload) throw new ApiError("Bukti upload banner tidak lengkap", 400);
          const resolved = await resolveUploadReference(newUpload.url);
          if (resolved.kind !== "local" || !resolved.exists || !resolved.isRegularFile || resolved.storageKey !== newUpload.publicId) throw new ApiError("File banner tidak tersedia atau tidak valid", 400);
          if ((await findUploadReferences(lifecycle, newUpload.publicId)).length > 0) throw new ApiError("File banner sudah digunakan", 409);
          bannerUrl = newUpload.url;
        }

        let frequency = values.frequency;
        if (values.categoryId) {
          const category = await tx.programCategory.findUnique({ where: { id: values.categoryId } });
          if (!category) throw new ApiError("Kategori tidak ditemukan", 404);
          const capabilityError = getCapabilityError(category);
          if (capabilityError) throw new ApiError(capabilityError, 422);
          if (usesDirectAdminScore(category)) {
            if (values.tw === null || values.tw < 1 || values.tw > 4) throw new ApiError("Program penilaian langsung wajib memiliki TW 1-4", 422);
            frequency = 1;
            const year = new Date(values.startDate).getUTCFullYear();
            await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`direct-program:${values.categoryId}:${year}:${values.tw}`}))::text`);
            const duplicate = await tx.programBudaya.findFirst({
              where: { id: { not: id }, categoryId: values.categoryId, tw: values.tw, startDate: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)) } },
              select: { id: true },
            });
            if (duplicate) throw new ApiError("Program penilaian langsung untuk kategori, tahun, dan TW ini sudah ada", 409);
          }
        }

        if (bannerUrl !== current.bannerUrl) {
          const oldKey = uploadKeyFromBanner(current.bannerUrl);
          if (oldKey) {
            const owner = await captureProgramBudayaOwner(lifecycle, { id });
            oldCleanup.push(capturePersistedOldCleanup(lifecycle, owner));
          }
        }

        const changed = await tx.programBudaya.updateMany({
          where: { id, updatedAt: expectedVersion },
          data: {
            name: values.name, description: values.description,
            frequency, tw: values.tw, startDate: values.startDate,
            endDate: values.endDate, uploadDeadline: values.uploadDeadline,
            categoryId: values.categoryId, bannerUrl,
            updatedAt: new Date(),
          },
        });
        if (changed.count !== 1) throw new ApiError("Program telah berubah. Muat ulang sebelum menyimpan.", 409);
        return tx.programBudaya.findUnique({ where: { id }, include: { category: true } });
      },
    );

    await Promise.allSettled(oldCleanup.map(cleanupOldBanner));
    return NextResponse.json(successResponse(updatedProgram, "Program berhasil diupdate"), { status: 200 });
  } catch (error) {
    await Promise.allSettled(verifiedUploads.map((upload) => rollbackVerifiedNewUpload(prisma, upload)));
    if (error instanceof UploadLifecycleError) return NextResponse.json(errorResponse("Upload banner tidak valid atau tidak dapat diproses", 400), { status: 400 });
    return handleApiError(error, "PUT /api/programs/[id]");
  }
}
