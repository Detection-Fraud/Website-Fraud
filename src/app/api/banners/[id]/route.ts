import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import {
  UploadLifecycleError,
  captureLoginBannerOwner,
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
  verifyNewUpload,
  withUploadLifecycleTransaction,
  type PersistedOldCleanup,
  type VerifiedNewUpload,
} from "@/lib/api/upload-lifecycle";
import {
  classifyStorageKey,
  resolveUploadReference,
} from "@/lib/api/upload-storage";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { Prisma } from "@generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateBannerSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  name: z.string().min(2).optional(),
  role: z.string().min(2).optional(),
  unit: z.string().min(2).optional(),
  period: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});
const updateReceiptSchema = z.object({
  bannerState: z.enum(["UNCHANGED", "REPLACED"]).default("UNCHANGED"),
  publicId: z.string().min(1).max(256).optional(),
  descriptor: z.string().min(1).max(4096).optional(),
  cleanupToken: z.string().min(1).max(4096).optional(),
});

const deleteBannerSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
});

// The sentinel sorts before UUID row IDs, so every collection writer locks it first.
const LOGIN_BANNER_COLLECTION_LOCK = "0";
const BANNER_NOT_FOUND = "Banner tidak ditemukan";
const STALE_BANNER = "Banner telah berubah. Muat ulang sebelum menyimpan.";

function parseBannerVersion(value: string): Date {
  try {
    return parseExpectedUpdatedAt(value);
  } catch {
    throw new ApiError("Versi data tidak valid", 400);
  }
}

async function lockLoginBannerRow(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "LoginBanner" WHERE "id" = ${id} FOR UPDATE`,
  );
}

function managedLoginBannerKey(imageUrl: string): string | null {
  if (!imageUrl.startsWith("/uploads/")) return null;
  const key = imageUrl.slice("/uploads/".length);
  return classifyStorageKey(key) === "banner-login" ? key : null;
}

async function cleanupOldBannerAfterCommit(
  cleanup: PersistedOldCleanup,
  routeName: string,
): Promise<void> {
  try {
    const outcome = await cleanupPersistedOldUploadAfterCommit(prisma, cleanup);
    if (outcome.kind === "failed") {
      console.error(`[${routeName}] managed old-file cleanup failed`, outcome);
    }
  } catch (error) {
    let fileKey: string | undefined;
    try {
      fileKey = readPersistedOldCleanup(cleanup).fileKey;
    } catch {
      // Only captured cleanup capabilities should reach this helper.
    }
    console.error(`[${routeName}] managed old-file cleanup failed`, {
      kind: "failed",
      ...(fileKey ? { fileKey } : {}),
      error,
    });
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const verifiedUploads: VerifiedNewUpload[] = [];
  let committed = false;
  let oldCleanup: PersistedOldCleanup | null = null;

  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const receiptParsed = updateReceiptSchema.safeParse(body);
    if (!receiptParsed.success) {
      return NextResponse.json(
        errorResponse("Receipt upload banner tidak valid", 400),
        { status: 400 },
      );
    }
    const { bannerState, publicId, descriptor, cleanupToken } = receiptParsed.data;
    const receipts = [publicId, descriptor, cleanupToken];
    const hasAnyReceipt = receipts.some((value) => value !== undefined);
    const hasAllReceipts = receipts.every((value) => value !== undefined);
    if (
      (bannerState === "REPLACED" && !hasAllReceipts) ||
      (bannerState === "UNCHANGED" && hasAnyReceipt)
    ) {
      return NextResponse.json(
        errorResponse("Receipt upload banner tidak lengkap atau tidak sesuai", 400),
        { status: 400 },
      );
    }

    let verifiedNew: { handle: VerifiedNewUpload; publicId: string; imageUrl: string } | null =
      null;
    if (bannerState === "REPLACED") {
      try {
        const context = createServerOwnedUploadContext({
          userId: session.user.id,
          purpose: "LOGIN_BANNER",
          mode: "REPLACEMENT",
          publicId: publicId!,
        });
        const handle = verifyNewUpload(descriptor!, cleanupToken!, context);
        verifiedUploads.push(handle);
        const state = readVerifiedNewUpload(handle);
        const resolved = await resolveUploadReference(state.url);
        if (
          resolved.kind !== "local" ||
          !resolved.exists ||
          !resolved.isRegularFile ||
          resolved.storageKey !== state.publicId
        ) {
          throw new ApiError("File banner tidak tersedia atau tidak valid", 400);
        }
        verifiedNew = {
          handle,
          publicId: state.publicId,
          imageUrl: state.url,
        };
      } catch (error) {
        if (error instanceof UploadLifecycleError) {
          throw new ApiError("Receipt upload banner tidak valid", 400);
        }
        throw error;
      }
    }

    const parsed = updateBannerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(errorResponse("Invalid input data", 400), {
        status: 400,
      });
    }

    const {
      expectedUpdatedAt,
      ...fields
    } = parsed.data;
    const expectedVersion = parseBannerVersion(expectedUpdatedAt);

    const existing = await prisma.loginBanner.findUnique({
      where: { id },
      select: { id: true, imageUrl: true, updatedAt: true },
    });
    if (!existing) {
      return NextResponse.json(errorResponse(BANNER_NOT_FOUND, 404), {
        status: 404,
      });
    }
    if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existing.updatedAt)) {
      return NextResponse.json(errorResponse(STALE_BANNER, 409), { status: 409 });
    }

    const oldFileKey = bannerState === "REPLACED"
      ? managedLoginBannerKey(existing.imageUrl)
      : null;
    const fileKeys = [
      ...(oldFileKey ? [oldFileKey] : []),
      ...(verifiedNew ? [verifiedNew.publicId] : []),
    ];
    const updated = await withUploadLifecycleTransaction(
      prisma,
      {
        entities: [
          { model: "LoginBanner", id: LOGIN_BANNER_COLLECTION_LOCK },
          { model: "LoginBanner", id },
        ],
        fileKeys,
      },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        await lockLoginBannerRow(tx, id);
        const locked = await tx.loginBanner.findUnique({ where: { id } });
        if (!locked) throw new ApiError(BANNER_NOT_FOUND, 404);
        if (!matchesExpectedUpdatedAt(expectedUpdatedAt, locked.updatedAt)) {
          throw new ApiError(STALE_BANNER, 409);
        }
        if (locked.imageUrl !== existing.imageUrl) {
          throw new ApiError(STALE_BANNER, 409);
        }

        let replacementImageUrl: string | undefined;
        if (verifiedNew) {
          const lockedUpload = readVerifiedNewUpload(verifiedNew.handle);
          const lockedFile = await resolveUploadReference(lockedUpload.url);
          if (
            lockedFile.kind !== "local" ||
            !lockedFile.exists ||
            !lockedFile.isRegularFile ||
            lockedUpload.publicId !== verifiedNew.publicId ||
            lockedFile.storageKey !== lockedUpload.publicId ||
            lockedFile.source !== "banner-login"
          ) {
            throw new ApiError("File banner tidak tersedia atau tidak valid", 400);
          }
          replacementImageUrl = lockedUpload.url;
          if ((await findUploadReferences(lifecycle, verifiedNew.publicId)).length > 0) {
            throw new ApiError("File banner telah digunakan", 409);
          }
          if (oldFileKey) {
            const owner = await captureLoginBannerOwner(lifecycle, { id });
            oldCleanup = capturePersistedOldCleanup(lifecycle, owner);
          }
        }

        const updateResult = await tx.loginBanner.updateMany({
          where: { id, updatedAt: expectedVersion },
          data: {
            ...fields,
            ...(replacementImageUrl ? { imageUrl: replacementImageUrl } : {}),
          },
        });
        if (updateResult.count !== 1) throw new ApiError(STALE_BANNER, 409);
        return tx.loginBanner.findUniqueOrThrow({ where: { id } });
      },
    );
    committed = true;
    if (oldCleanup) {
      await cleanupOldBannerAfterCommit(
        oldCleanup,
        "PATCH /api/banners/[id]",
      );
    }
    return NextResponse.json(successResponse(updated, "Banner berhasil diupdate"));
  } catch (error) {
    return handleApiError(error, "PATCH /api/banners/[id]");
  } finally {
    if (!committed && verifiedUploads.length > 0) {
      await Promise.allSettled(
        verifiedUploads.map((upload) => rollbackVerifiedNewUpload(prisma, upload)),
      );
    }
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  let oldCleanup: PersistedOldCleanup | null = null;

  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = deleteBannerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse("expectedUpdatedAt wajib diisi dengan versi yang valid", 400),
        { status: 400 },
      );
    }
    const { expectedUpdatedAt } = parsed.data;
    const expectedVersion = parseBannerVersion(expectedUpdatedAt);
    const existing = await prisma.loginBanner.findUnique({
      where: { id },
      select: { id: true, imageUrl: true, updatedAt: true },
    });
    if (!existing) {
      return NextResponse.json(errorResponse(BANNER_NOT_FOUND, 404), {
        status: 404,
      });
    }
    if (!matchesExpectedUpdatedAt(expectedUpdatedAt, existing.updatedAt)) {
      return NextResponse.json(errorResponse(STALE_BANNER, 409), { status: 409 });
    }

    const oldFileKey = managedLoginBannerKey(existing.imageUrl);
    await withUploadLifecycleTransaction(
      prisma,
      {
        entities: [
          { model: "LoginBanner", id: LOGIN_BANNER_COLLECTION_LOCK },
          { model: "LoginBanner", id },
        ],
        fileKeys: oldFileKey ? [oldFileKey] : [],
      },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        await lockLoginBannerRow(tx, id);
        const locked = await tx.loginBanner.findUnique({ where: { id } });
        if (!locked) throw new ApiError(BANNER_NOT_FOUND, 404);
        if (
          !matchesExpectedUpdatedAt(expectedUpdatedAt, locked.updatedAt) ||
          locked.imageUrl !== existing.imageUrl
        ) {
          throw new ApiError(STALE_BANNER, 409);
        }
        if (oldFileKey) {
          const owner = await captureLoginBannerOwner(lifecycle, { id });
          oldCleanup = capturePersistedOldCleanup(lifecycle, owner);
        }
        const result = await tx.loginBanner.deleteMany({
          where: { id, updatedAt: expectedVersion },
        });
        if (result.count !== 1) throw new ApiError(STALE_BANNER, 409);
      },
    );
    if (oldCleanup) {
      await cleanupOldBannerAfterCommit(
        oldCleanup,
        "DELETE /api/banners/[id]",
      );
    }
    return NextResponse.json(successResponse(null, "Banner berhasil dihapus"));
  } catch (error) {
    return handleApiError(error, "DELETE /api/banners/[id]");
  }
}
