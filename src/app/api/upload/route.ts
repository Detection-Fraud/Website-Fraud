import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  createServerOwnedUploadContext,
  mintCleanupToken,
  mintUploadDescriptor,
  rollbackVerifiedNewUpload,
  UploadLifecycleError,
  verifyNewUpload,
} from "@/lib/api/upload-lifecycle";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import {
  getUtcYearMonthPartition,
  prepareManagedUploadWritePath,
} from "@/lib/api/upload-storage";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

const purposeSchema = z.enum([
  "EVIDENCE",
  "PROGRAM_BANNER",
  "CATEGORY_BANNER",
  "LOGIN_BANNER",
]);

const modeSchema = z.enum(["CREATE", "REPLACEMENT"]);

const uploadFieldsSchema = z
  .object({
    purpose: purposeSchema,
    mode: modeSchema,
    reportId: z.string().uuid().optional(),
  })
  .strict();

const deleteUploadSchema = z
  .object({
    publicId: z.string().min(1).max(256),
    descriptor: z.string().min(1).max(4096),
    cleanupToken: z.string().min(1).max(4096),
    purpose: purposeSchema,
    mode: modeSchema,
    reportId: z.string().uuid().optional(),
  })
  .strict();

type UploadFields = z.infer<typeof uploadFieldsSchema>;

function isValidImageBuffer(buffer: Buffer) {
  const jpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const png =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  return jpeg || png;
}

function createStorageKey(
  purpose: UploadFields["purpose"],
  unitId: string | undefined,
  timestamp: Date,
) {
  const filename = `${randomUUID()}.jpg`;

  if (purpose === "EVIDENCE") {
    if (!unitId) {
      throw new UploadLifecycleError("UNIT_REQUIRED");
    }

    const { year, month } = getUtcYearMonthPartition(timestamp);

    return `reports/${unitId}/${year}/${month}/${filename}`;
  }

  const namespace = {
    PROGRAM_BANNER: "programs",
    CATEGORY_BANNER: "categories",
    LOGIN_BANNER: "login",
  }[purpose];

  return `banners/${namespace}/${filename}`;
}

async function resolveEvidenceUnit(
  user: {
    id: string;
    unitId?: string | null;
  },
  mode: UploadFields["mode"],
  reportId?: string,
) {
  if (!user.unitId) {
    throw new UploadLifecycleError("UNIT_REQUIRED");
  }

  if (mode === "CREATE") {
    if (reportId) {
      throw new UploadLifecycleError("REPORT_FORBIDDEN");
    }

    return user.unitId;
  }

  if (!reportId) {
    throw new UploadLifecycleError("REPORT_REQUIRED");
  }

  const report = await prisma.activityReport.findFirst({
    where: {
      id: reportId,
      createdById: user.id,
      unitId: user.unitId,
    },
    select: {
      id: true,
      unitId: true,
    },
  });

  if (!report?.unitId) {
    throw new UploadLifecycleError("REPORT_NOT_FOUND");
  }

  return report.unitId;
}

async function resolveContext(
  user: {
    id: string;
    role?: string | null;
    unitId?: string | null;
  },
  fields: UploadFields,
  publicId: string,
  resolvedUnitId?: string,
) {
  const isEvidence = fields.purpose === "EVIDENCE";

  if (isEvidence && user.role !== "PIC") {
    return {
      error: NextResponse.json(
        errorResponse("Hanya PIC yang dapat mengunggah evidence", 403),
        { status: 403 },
      ),
    };
  }

  if (!isEvidence && user.role !== "ADMIN") {
    return {
      error: NextResponse.json(
        errorResponse("Hanya Admin yang dapat mengunggah banner", 403),
        { status: 403 },
      ),
    };
  }

  if (!isEvidence && fields.reportId) {
    throw new UploadLifecycleError("REPORT_CONTEXT_FORBIDDEN");
  }

  const unitId = isEvidence
    ? (resolvedUnitId ??
      (await resolveEvidenceUnit(user, fields.mode, fields.reportId)))
    : undefined;

  return {
    context: createServerOwnedUploadContext({
      userId: user.id,
      purpose: fields.purpose,
      mode: fields.mode,
      publicId,
      ...(unitId ? { unitId } : {}),
      ...(fields.reportId ? { reportId: fields.reportId } : {}),
    }),
  };
}

function lifecycleErrorResponse(error: UploadLifecycleError) {
  const status =
    error.code === "REPORT_NOT_FOUND"
      ? 404
      : [
            "INVALID_TOKEN",
            "EXPIRED_TOKEN",
            "CONTEXT_MISMATCH",
            "ARTIFACT_MISMATCH",
            "UNVERIFIED_UPLOAD",
            "UNVERIFIED_UPLOAD_PAIR",
          ].includes(error.code)
        ? 403
        : 400;

  return NextResponse.json(
    errorResponse("Kredensial upload tidak valid", status),
    { status },
  );
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    keyPrefix: "upload",
    max: 20,
  });

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  try {
    const session = await requireAuth();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(errorResponse("File wajib diisi", 400), {
        status: 400,
      });
    }

    const fields = uploadFieldsSchema.safeParse({
      purpose: formData.get("purpose"),
      mode: formData.get("mode"),
      reportId: formData.get("reportId") || undefined,
    });

    if (!fields.success) {
      return NextResponse.json(
        errorResponse("Purpose dan mode upload wajib diisi", 400),
        { status: 400 },
      );
    }

    if (fields.data.purpose === "EVIDENCE" && session.user.role !== "PIC") {
      return NextResponse.json(
        errorResponse("Hanya PIC yang dapat mengunggah evidence", 403),
        { status: 403 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(errorResponse("File maksimal 2MB", 400), {
        status: 400,
      });
    }

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      return NextResponse.json(errorResponse("Tipe file tidak didukung", 400), {
        status: 400,
      });
    }

    const sourceBuffer = Buffer.from(await file.arrayBuffer());

    if (!isValidImageBuffer(sourceBuffer)) {
      return NextResponse.json(
        errorResponse("Konten file bukan gambar yang valid", 400),
        { status: 400 },
      );
    }

    const now = new Date();

    const unitId =
      fields.data.purpose === "EVIDENCE"
        ? await resolveEvidenceUnit(
            session.user,
            fields.data.mode,
            fields.data.reportId,
          )
        : undefined;

    const publicId = createStorageKey(fields.data.purpose, unitId, now);

    const resolvedContext = await resolveContext(
      session.user,
      fields.data,
      publicId,
      unitId,
    );

    if (resolvedContext.error) {
      return resolvedContext.error;
    }

    let compressedBuffer: Buffer;

    try {
      compressedBuffer = await sharp(sourceBuffer)
        .resize(1920, 1920, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 90,
          progressive: true,
        })
        .withMetadata()
        .toBuffer();
    } catch {
      return NextResponse.json(
        errorResponse("File gambar tidak dapat diproses", 400),
        { status: 400 },
      );
    }

    const descriptor = mintUploadDescriptor(resolvedContext.context, now);
    const cleanupToken = mintCleanupToken(resolvedContext.context, now);
    const verifiedUpload = verifyNewUpload(
      descriptor.descriptor,
      cleanupToken,
      resolvedContext.context,
      now,
    );
    const filePath = await prepareManagedUploadWritePath(publicId);

    let fileHandle: Awaited<ReturnType<typeof open>> | undefined;
    let writeError: unknown;
    try {
      fileHandle = await open(filePath, "wx");
      await fileHandle.writeFile(compressedBuffer);
    } catch (error) {
      writeError = error;
    }
    try {
      await fileHandle?.close();
    } catch (error) {
      writeError ??= error;
    }
    if (writeError !== undefined) {
      if (fileHandle) await rollbackVerifiedNewUpload(prisma, verifiedUpload);
      throw writeError;
    }

    return NextResponse.json(
      {
        message: "Upload Berhasil",
        url: descriptor.url,
        publicId: descriptor.publicId,
        descriptor: descriptor.descriptor,
        cleanupToken,
        size: compressedBuffer.length,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof UploadLifecycleError) {
      return lifecycleErrorResponse(error);
    }

    return handleApiError(error, "POST /api/upload");
  }
}

export async function DELETE(request: Request) {
  const rateLimit = checkRateLimit(request, {
    keyPrefix: "upload-cleanup",
    max: 40,
  });

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => null);
    const parsed = deleteUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(errorResponse("Data cleanup tidak valid", 400), {
        status: 400,
      });
    }

    const fields = parsed.data;

    const resolvedContext = await resolveContext(
      session.user,
      fields,
      fields.publicId,
    );

    if (resolvedContext.error) {
      return resolvedContext.error;
    }

    const verifiedUpload = verifyNewUpload(
      fields.descriptor,
      fields.cleanupToken,
      resolvedContext.context,
    );

    const cleanup = await rollbackVerifiedNewUpload(prisma, verifiedUpload);

    return NextResponse.json({
      message:
        cleanup.kind === "deleted"
          ? "File sementara berhasil dihapus"
          : cleanup.kind === "retained"
            ? "File sudah digunakan dan tidak dihapus"
            : "File sementara sudah tidak tersedia",
      deleted: cleanup.kind === "deleted",
    });
  } catch (error) {
    if (error instanceof UploadLifecycleError) {
      return lifecycleErrorResponse(error);
    }

    return handleApiError(error, "DELETE /api/upload");
  }
}
