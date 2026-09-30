import {
  getCategoryLocks,
  getCategoryUsageByCategoryIds,
} from "@/lib/api/category-usage";
import {
  ApiError,
  handleApiError,
  requireAdmin,
  requireAuth,
} from "@/lib/api/auth-guard";
import {
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
import { categoryQuerySchema } from "@/schemas/category-query.schema";
import { createCategorySchema } from "@/schemas/program.schema";
import { Prisma } from "@generated/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const uploadFieldsSchema = z.object({
  bannerState: z.enum(["NONE", "UNCHANGED", "REPLACED", "REMOVED"]),
  bannerPublicId: z.string().min(1).optional(),
  bannerDescriptor: z.string().min(1).optional(),
  bannerCleanupToken: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  const artifacts = [value.bannerPublicId, value.bannerDescriptor, value.bannerCleanupToken];
  if (value.bannerState === "REPLACED" && artifacts.some((item) => !item)) {
    ctx.addIssue({ code: "custom", path: ["bannerDescriptor"], message: "Upload receipt tidak lengkap" });
  }
  if (value.bannerState !== "REPLACED" && artifacts.some((item) => item !== undefined)) {
    ctx.addIssue({ code: "custom", path: ["bannerDescriptor"], message: "Receipt hanya boleh dikirim untuk banner pengganti" });
  }
});

async function verifyCategoryBanner(
  userId: string,
  fields: z.infer<typeof uploadFieldsSchema>,
): Promise<{ upload: VerifiedNewUpload; publicId: string; url: string } | null> {
  if (fields.bannerState !== "REPLACED") return null;
  let upload: VerifiedNewUpload | undefined;
  try {
    const context = createServerOwnedUploadContext({
      userId,
      purpose: "CATEGORY_BANNER",
      mode: "CREATE",
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

export async function GET(req: Request) {
  try {
    await requireAuth();

    const query = categoryQuerySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams.entries()),
    );
    if (!query.success) {
      return NextResponse.json(
        errorResponse("Filter kategori tidak valid", 400, z.treeifyError(query.error)),
        { status: 400 },
      );
    }

    const where: Prisma.ProgramCategoryWhereInput = {};
    if (query.data.targetUnit !== undefined) where.targetUnit = query.data.targetUnit;
    if (query.data.evidenceMode !== undefined) where.evidenceMode = query.data.evidenceMode;
    if (query.data.scoreInputMode !== undefined) where.scoreInputMode = query.data.scoreInputMode;

    const categories = await prisma.programCategory.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        bannerUrl: true,
        targetUnit: true,
        defaultFrequency: true,
        evidenceMode: true,
        scoreInputMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const usageByCategoryId = await getCategoryUsageByCategoryIds(categories.map((category) => category.id));
    const data = categories.map((category) => {
      const usage = usageByCategoryId.get(category.id);
      if (!usage) throw new Error(`Missing usage aggregate for category ${category.id}`);
      return {
        ...category,
        usage,
        locks: getCategoryLocks(usage),
        totalProgram: usage.programCount,
        totalActive: usage.activeProgramCount,
      };
    });

    return NextResponse.json(successResponse(data, "Berhasil mengambil data kategori"), { status: 200 });
  } catch (error) {
    return handleApiError(error, "GET /api/programs/categories");
  }
}

export async function POST(req: Request) {
  let verifiedUpload: VerifiedNewUpload | undefined;
  let committed = false;
  try {
    const session = await requireAdmin();
    const body: unknown = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    const uploadFields = uploadFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(errorResponse("Validasi gagal", 400, z.treeifyError(parsed.error)), { status: 400 });
    }
    if (!uploadFields.success) {
      return NextResponse.json(errorResponse("Validasi gagal", 400, z.treeifyError(uploadFields.error)), { status: 400 });
    }
    if (uploadFields.data.bannerState === "UNCHANGED" || uploadFields.data.bannerState === "REMOVED") {
      return NextResponse.json(
        errorResponse("Status banner tidak valid untuk membuat kategori", 400, {
          bannerState: uploadFields.data.bannerState,
        }),
        { status: 400 },
      );
    }

    const upload = await verifyCategoryBanner(session.user.id, uploadFields.data);
    if (upload) verifiedUpload = upload.upload;
    const category = await withUploadLifecycleTransaction(
      prisma,
      { entities: [], fileKeys: upload ? [upload.publicId] : [] },
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
        const existing = await tx.programCategory.findUnique({
          where: { name: parsed.data.name },
          select: { id: true },
        });
        if (existing) throw new ApiError("Kategori sudah ada", 409);
        if (upload && (await findUploadReferences(lifecycle, upload.publicId)).length > 0) {
          throw new ApiError("File banner sudah digunakan", 409);
        }
        const created = await tx.programCategory.create({
          data: { ...parsed.data, bannerUrl: upload?.url ?? null },
        });
        if (upload) {
          const references = await findUploadReferences(lifecycle, upload.publicId);
          if (references.some((reference) => reference.owner.kind !== "ProgramCategory" || reference.owner.id !== created.id)) {
            throw new ApiError("File banner sudah digunakan", 409);
          }
        }
        return created;
      },
    );
    committed = true;
    return NextResponse.json(successResponse(category, "success create category"), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(errorResponse("Kategori sudah ada", 409), { status: 409 });
    }
    return handleApiError(error, "POST /api/programs/categories");
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
