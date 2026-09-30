import {
  ApiError,
  handleApiError,
  requireAdmin,
} from "@/lib/api/auth-guard";
import {
  capturePersistedOldCleanup,
  captureProgramCategoryOwner,
  cleanupPersistedOldUploadAfterCommit,
  createServerOwnedUploadContext,
  findUploadReferences,
  getUploadLifecycleTransaction,
  parseExpectedUpdatedAt,
  readVerifiedNewUpload,
  rollbackVerifiedNewUpload,
  verifyNewUpload,
  withUploadLifecycleTransaction,
  type PersistedOldCleanup,
  type VerifiedNewUpload,
} from "@/lib/api/upload-lifecycle";
import { resolveUploadReference, classifyUploadReference } from "@/lib/api/upload-storage";
import { getCapabilityError } from "@/lib/program-capabilities";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { updateCategorySchema } from "@/schemas/program.schema";
import { Prisma } from "@generated/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const uploadFieldsSchema = z.object({
  bannerState: z.enum(["NONE", "UNCHANGED", "REPLACED", "REMOVED"]),
  bannerPublicId: z.string().min(1).optional(),
  bannerDescriptor: z.string().min(1).optional(),
  bannerCleanupToken: z.string().min(1).optional(),
  expectedUpdatedAt: z.string().min(1),
}).superRefine((value, ctx) => {
  const artifacts = [value.bannerPublicId, value.bannerDescriptor, value.bannerCleanupToken];
  if (value.bannerState === "REPLACED" && artifacts.some((item) => !item)) {
    ctx.addIssue({ code: "custom", path: ["bannerDescriptor"], message: "Upload receipt tidak lengkap" });
  }
  if (value.bannerState !== "REPLACED" && artifacts.some((item) => item !== undefined)) {
    ctx.addIssue({ code: "custom", path: ["bannerDescriptor"], message: "Receipt hanya boleh dikirim untuk banner pengganti" });
  }
});

async function verifyReplacement(userId: string, fields: z.infer<typeof uploadFieldsSchema>) {
  if (fields.bannerState !== "REPLACED") return null;
  let upload: VerifiedNewUpload | undefined;
  try {
    const context = createServerOwnedUploadContext({
      userId,
      purpose: "CATEGORY_BANNER",
      mode: "REPLACEMENT",
      publicId: fields.bannerPublicId!,
    });
    upload = verifyNewUpload(fields.bannerDescriptor!, fields.bannerCleanupToken!, context);
    const verified = readVerifiedNewUpload(upload);
    const resolved = await resolveUploadReference(verified.url);
    if (
      resolved.kind !== "local" ||
      resolved.storageKey !== verified.publicId ||
      resolved.source !== "banner-categories" ||
      !resolved.exists ||
      !resolved.isRegularFile
    ) throw new ApiError("File banner tidak valid", 422);
    return { upload, publicId: verified.publicId, url: verified.url };
  } catch (error) {
    if (upload) {
      try {
        await rollbackVerifiedNewUpload(prisma, upload);
      } catch (cleanupError) {
        console.error("[category-upload] rollback failed", cleanupError);
      }
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError("Upload banner tidak valid atau kedaluwarsa", 422);
  }
}

function getManagedCategoryFileKey(value: string | null) {
  if (!value) return null;
  const classification = classifyUploadReference(value);
  return classification.kind === "local" && classification.source === "banner-categories"
    ? classification.storageKey
    : null;
}

async function getUsage(tx: Prisma.TransactionClient, id: string) {
  const [programCount, reportCount, participationCount, historyCount] = await Promise.all([
    tx.programBudaya.count({ where: { categoryId: id } }),
    tx.activityReport.count({ where: { program: { categoryId: id } } }),
    tx.participationData.count({ where: { categoryId: id } }),
    tx.participationScoreHistory.count({ where: { categoryId: id } }),
  ]);
  return { programCount, reportCount, participationCount, historyCount };
}

function throwUsageConflict(usage: Awaited<ReturnType<typeof getUsage>>, message: string) {
  if (usage.programCount + usage.reportCount + usage.participationCount + usage.historyCount > 0) {
    throw new ApiError(message, 409);
  }
}

function validateExpectedUpdatedAt(value: string) {
  try {
    return parseExpectedUpdatedAt(value);
  } catch {
    throw new ApiError("Versi kategori tidak valid", 400);
  }
}

function throwIfReferencedByOtherOwner(
  references: Awaited<ReturnType<typeof findUploadReferences>>,
  ownId: string,
) {
  if (references.some((reference) => reference.owner.kind !== "ProgramCategory" || reference.owner.id !== ownId)) {
    throw new ApiError("File banner sudah digunakan", 409);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  let verifiedUpload: VerifiedNewUpload | undefined;
  let committed = false;
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = updateCategorySchema.safeParse(body);
    const uploadFields = uploadFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse("Validasi gagal", 400, z.treeifyError(parsed.error)),
        { status: 400 },
      );
    }
    if (!uploadFields.success) {
      return NextResponse.json(
        errorResponse("Validasi gagal", 400, z.treeifyError(uploadFields.error)),
        { status: 400 },
      );
    }
    const expectedUpdatedAt = validateExpectedUpdatedAt(uploadFields.data.expectedUpdatedAt);
    const initial = await prisma.programCategory.findUnique({ where: { id } });
    if (!initial) return NextResponse.json(errorResponse("Kategori tidak ditemukan", 404), { status: 404 });

    const upload = await verifyReplacement(session.user.id, uploadFields.data);
    if (upload) verifiedUpload = upload.upload;
    const bannerChanged = uploadFields.data.bannerState === "REPLACED" || uploadFields.data.bannerState === "REMOVED";
    const oldFileKey = bannerChanged ? getManagedCategoryFileKey(initial.bannerUrl) : null;
    const fileKeys = [oldFileKey, upload?.publicId].filter((key): key is string => !!key);

    const result = await withUploadLifecycleTransaction(
      prisma,
      { entities: [{ model: "ProgramCategory", id }], fileKeys },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        if (upload) {
          const resolved = await resolveUploadReference(upload.url);
          if (
            resolved.kind !== "local" ||
            resolved.storageKey !== upload.publicId ||
            resolved.source !== "banner-categories" ||
            !resolved.exists ||
            !resolved.isRegularFile
          ) throw new ApiError("File banner tidak valid", 422);
        }
        const current = await tx.programCategory.findUnique({ where: { id } });
        if (!current) throw new ApiError("Kategori tidak ditemukan", 404);
        if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new ApiError("Kategori sudah berubah, muat ulang lalu coba lagi", 409);
        if (current.bannerUrl !== initial.bannerUrl) throw new ApiError("Banner kategori sudah berubah, muat ulang lalu coba lagi", 409);

        const state = uploadFields.data.bannerState;
        if ((state === "UNCHANGED" && !current.bannerUrl) || (state === "NONE" && current.bannerUrl !== null) || (state === "REMOVED" && !current.bannerUrl)) {
          throw new ApiError("Status banner kategori tidak sesuai data tersimpan", 422);
        }

        const merged = {
          targetUnit: parsed.data.targetUnit ?? current.targetUnit,
          evidenceMode: parsed.data.evidenceMode ?? current.evidenceMode,
          scoreInputMode: parsed.data.scoreInputMode ?? current.scoreInputMode,
        };
        const capabilityError = getCapabilityError(merged);
        if (capabilityError) throw new ApiError(capabilityError, 422);
        const capabilityChanges = merged.targetUnit !== current.targetUnit || merged.evidenceMode !== current.evidenceMode || merged.scoreInputMode !== current.scoreInputMode;
        if (capabilityChanges) {
          throwUsageConflict(
            await getUsage(tx, id),
            "Kapabilitas kategori tidak dapat diubah karena sudah memiliki program, laporan, data partisipasi, atau riwayat skor",
          );
        }

        let cleanup: PersistedOldCleanup | undefined;
        if (oldFileKey) {
          const owner = await captureProgramCategoryOwner(lifecycle, { id });
          cleanup = capturePersistedOldCleanup(lifecycle, owner);
        }
        if (upload && (await findUploadReferences(lifecycle, upload.publicId)).length > 0) {
          throw new ApiError("File banner sudah digunakan", 409);
        }

        const category = await tx.programCategory.update({
          where: { id },
          data: {
            ...parsed.data,
            bannerUrl: state === "REPLACED" ? upload!.url : state === "REMOVED" ? null : current.bannerUrl,
          },
        });
        if (upload) throwIfReferencedByOtherOwner(await findUploadReferences(lifecycle, upload.publicId), id);
        return { category, cleanup };
      },
    );
    committed = true;
    if (result.cleanup) {
      try {
        await cleanupPersistedOldUploadAfterCommit(prisma, result.cleanup);
      } catch (cleanupError) {
        console.error("[category-upload] post-commit cleanup failed", cleanupError);
      }
    }
    return NextResponse.json(successResponse(result.category, "success update category"), { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(errorResponse("Kategori sudah ada", 409), { status: 409 });
    }
    return handleApiError(error, "PUT /api/programs/categories/[id]");
  } finally {
    if (verifiedUpload && !committed) {
      try {
        await rollbackVerifiedNewUpload(prisma, verifiedUpload);
      } catch (cleanupError) {
        console.error("[category-upload] rollback failed", cleanupError);
      }
    }
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  let cleanup: PersistedOldCleanup | undefined;
  try {
    await requireAdmin();
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(errorResponse("Versi kategori wajib dikirim", 400), { status: 400 });
    }
    const parsed = z.object({ expectedUpdatedAt: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return NextResponse.json(errorResponse("Versi kategori wajib dikirim", 400, z.treeifyError(parsed.error)), { status: 400 });
    const expectedUpdatedAt = validateExpectedUpdatedAt(parsed.data.expectedUpdatedAt);
    const initial = await prisma.programCategory.findUnique({ where: { id }, select: { id: true, bannerUrl: true } });
    if (!initial) return NextResponse.json(errorResponse("Kategori tidak ditemukan", 404), { status: 404 });

    const oldFileKey = getManagedCategoryFileKey(initial.bannerUrl);
    await withUploadLifecycleTransaction(
      prisma,
      { entities: [{ model: "ProgramCategory", id }], fileKeys: oldFileKey ? [oldFileKey] : [] },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        const current = await tx.programCategory.findUnique({ where: { id } });
        if (!current) throw new ApiError("Kategori tidak ditemukan", 404);
        if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new ApiError("Kategori sudah berubah, muat ulang lalu coba lagi", 409);
        if (current.bannerUrl !== initial.bannerUrl) throw new ApiError("Banner kategori sudah berubah, muat ulang lalu coba lagi", 409);
        throwUsageConflict(await getUsage(tx, id), "Kategori tidak dapat dihapus karena masih memiliki data terkait");

        if (oldFileKey) {
          const owner = await captureProgramCategoryOwner(lifecycle, { id });
          cleanup = capturePersistedOldCleanup(lifecycle, owner);
        }
        await tx.programCategory.delete({ where: { id } });
        return true;
      },
    );
    if (cleanup) {
      try {
        await cleanupPersistedOldUploadAfterCommit(prisma, cleanup);
      } catch (cleanupError) {
        console.error("[category-upload] post-commit cleanup failed", cleanupError);
      }
    }
    return NextResponse.json(successResponse(null, "success delete category"), { status: 200 });
  } catch (error) {
    return handleApiError(error, "DELETE /api/programs/categories/[id]");
  }
}
