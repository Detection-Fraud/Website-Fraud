import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import {
  UploadLifecycleError,
  createServerOwnedUploadContext,
  findUploadReferences,
  getUploadLifecycleTransaction,
  readVerifiedNewUpload,
  rollbackVerifiedNewUpload,
  verifyNewUpload,
  withUploadLifecycleTransaction,
  type VerifiedNewUpload,
} from "@/lib/api/upload-lifecycle";
import { resolveUploadReference } from "@/lib/api/upload-storage";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";
import { z } from "zod";

const bannerSchema = z.object({
  imageUrl: z.string().min(1),
  bannerState: z.literal("REPLACED"),
  publicId: z.string().min(1).max(256),
  descriptor: z.string().min(1).max(4096),
  cleanupToken: z.string().min(1).max(4096),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  role: z.string().min(2, "Role/Jabatan wajib diisi"),
  unit: z.string().min(2, "Unit kerja wajib diisi"),
  period: z.string().min(2, "Periode wajib diisi"),
  order: z.number().int().optional(),
});
const bannerReceiptSchema = z.object({
  bannerState: z.literal("REPLACED"),
  publicId: z.string().min(1).max(256),
  descriptor: z.string().min(1).max(4096),
  cleanupToken: z.string().min(1).max(4096),
});
const adminBannerPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});

// The sentinel sorts before UUID row IDs, so every collection writer locks it first.
const LOGIN_BANNER_COLLECTION_LOCK = "0";

async function resolveNewBannerUpload(
  userId: string,
  receipt: z.infer<typeof bannerReceiptSchema>,
  verifiedUploads: VerifiedNewUpload[],
): Promise<{ handle: VerifiedNewUpload; publicId: string; imageUrl: string }> {
  const context = createServerOwnedUploadContext({
    userId,
    purpose: "LOGIN_BANNER",
    mode: "CREATE",
    publicId: receipt.publicId,
  });
  const handle = verifyNewUpload(receipt.descriptor, receipt.cleanupToken, context);
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
  return { handle, publicId: state.publicId, imageUrl: state.url };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "true";

    if (!showAll) {
      const banners = await prisma.loginBanner.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        take: 20,
      });
      return NextResponse.json(successResponse(banners));
    }

    await requireAdmin();
    const parsed = adminBannerPaginationSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
        { status: 400 },
      );
    }

    const { page, pageSize } = parsed.data;
    const [total, activeCount] = await Promise.all([
      prisma.loginBanner.count(),
      prisma.loginBanner.count({ where: { isActive: true } }),
    ]);
    const totalPages = Math.ceil(total / pageSize);
    const items = page > totalPages
      ? []
      : await prisma.loginBanner.findMany({
          where: {},
          orderBy: [{ order: "asc" }, { id: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        });
    return NextResponse.json(
      successResponse({ items, total, activeCount, page, pageSize, totalPages }),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/banners");
  }
}

export async function POST(req: Request) {
  const verifiedUploads: VerifiedNewUpload[] = [];
  let committed = false;
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const receipt = bannerReceiptSchema.safeParse(body);
    if (!receipt.success) {
      return NextResponse.json(
        errorResponse("Receipt upload banner tidak lengkap atau tidak valid", 400),
        { status: 400 },
      );
    }

    let upload: Awaited<ReturnType<typeof resolveNewBannerUpload>>;
    try {
      upload = await resolveNewBannerUpload(
        session.user.id,
        receipt.data,
        verifiedUploads,
      );
    } catch (error) {
      if (error instanceof UploadLifecycleError) {
        throw new ApiError("Receipt upload banner tidak valid", 400);
      }
      throw error;
    }

    const parsed = bannerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
        { status: 400 },
      );
    }

    const banner = await withUploadLifecycleTransaction(
      prisma,
      {
        entities: [{ model: "LoginBanner", id: LOGIN_BANNER_COLLECTION_LOCK }],
        fileKeys: [upload.publicId],
      },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        const lockedUpload = readVerifiedNewUpload(upload.handle);
        const lockedFile = await resolveUploadReference(lockedUpload.url);
        if (
          lockedFile.kind !== "local" ||
          !lockedFile.exists ||
          !lockedFile.isRegularFile ||
          lockedUpload.publicId !== upload.publicId ||
          lockedFile.storageKey !== lockedUpload.publicId ||
          lockedFile.source !== "banner-login"
        ) {
          throw new ApiError("File banner tidak tersedia atau tidak valid", 400);
        }
        if ((await findUploadReferences(lifecycle, upload.publicId)).length > 0) {
          throw new ApiError("File banner telah digunakan", 409);
        }
        const latest = await tx.loginBanner.aggregate({ _max: { order: true } });
        return tx.loginBanner.create({
          data: {
            imageUrl: lockedUpload.url,
            name: parsed.data.name,
            role: parsed.data.role,
            unit: parsed.data.unit,
            period: parsed.data.period,
            order: (latest._max.order ?? -1) + 1,
            isActive: true,
          },
        });
      },
    );
    committed = true;

    return NextResponse.json(
      successResponse(banner, "Banner berhasil ditambahkan"),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST /api/banners");
  } finally {
    if (!committed && verifiedUploads.length > 0) {
      await Promise.allSettled(
        verifiedUploads.map((upload) => rollbackVerifiedNewUpload(prisma, upload)),
      );
    }
  }
}
