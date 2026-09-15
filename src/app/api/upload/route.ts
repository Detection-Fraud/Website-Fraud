import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import sharp from "sharp";
import { z } from "zod";

const UPLOAD_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/;
const CLEANUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const deleteUploadSchema = z
  .object({
    publicId: z.string().regex(UPLOAD_NAME_PATTERN),
    cleanupToken: z.string().min(1).max(256),
  })
  .strict();

function getUploadDirectory() {
  return path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads"),
  );
}

function getUploadPath(publicId: string) {
  const uploadDir = getUploadDirectory();
  const filePath = path.resolve(uploadDir, publicId);
  return path.dirname(filePath) === uploadDir ? filePath : null;
}

function getCleanupSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Upload cleanup secret is not configured");
  return secret;
}

function cleanupSignature(publicId: string, userId: string, expiresAt: number) {
  return createHmac("sha256", getCleanupSecret())
    .update(`upload-cleanup\n${publicId}\n${userId}\n${expiresAt}`)
    .digest("base64url");
}

function createCleanupToken(publicId: string, userId: string) {
  const expiresAt = Date.now() + CLEANUP_TOKEN_TTL_MS;
  return `${expiresAt}.${cleanupSignature(publicId, userId, expiresAt)}`;
}

function isValidCleanupToken(
  publicId: string,
  userId: string,
  cleanupToken: string,
) {
  const separator = cleanupToken.indexOf(".");
  if (separator <= 0) return false;

  const expiresAt = Number(cleanupToken.slice(0, separator));
  const received = cleanupToken.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now()) return false;

  const expected = cleanupSignature(publicId, userId, expiresAt);
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

async function isUploadReferenced(publicId: string) {
  const imageUrl = `/uploads/${publicId}`;
  const references = await Promise.all([
    prisma.activityPhoto.findFirst({
      where: { OR: [{ publicId }, { imageUrl }] },
      select: { id: true },
    }),
    prisma.programBudaya.findFirst({
      where: { bannerUrl: imageUrl },
      select: { id: true },
    }),
    prisma.programCategory.findFirst({
      where: { bannerUrl: imageUrl },
      select: { id: true },
    }),
    prisma.loginBanner.findFirst({
      where: { imageUrl },
      select: { id: true },
    }),
  ]);
  return references.some(Boolean);
}

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { keyPrefix: "upload", max: 20 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(errorResponse("File wajib diisi", 400), {
        status: 400,
      });
    }

    const MAX_SIZE_BYTES = 2 * 1024 * 1024; // Maksimal 2MB
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(errorResponse(`File maksimal 2MB`, 400), {
        status: 400,
      });
    }

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(errorResponse(`Tipe file tidak didukung`, 400), {
        status: 400,
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validasi Magic Bytes
    const jpegMagic = buffer[0] === 0xff && buffer[1] === 0xd8;
    const pngMagic = buffer[0] === 0x89 && buffer[1] === 0x50;

    if (!jpegMagic && !pngMagic) {
      return NextResponse.json(
        errorResponse("Konten file bukan gambar yang valid", 400),
        { status: 400 },
      );
    }

    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await sharp(buffer)
        .resize(1920, 1920, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90, progressive: true })
        .withMetadata()
        .toBuffer();
    } catch (sharpErr) {
      console.error("[upload] sharp compression failed:", sharpErr);
      compressedBuffer = buffer;
    }

    const uploadDir = getUploadDirectory();
    await mkdir(uploadDir, { recursive: true });

    const uniqueName = `${randomUUID()}.jpg`;
    const filePath = getUploadPath(uniqueName);
    if (!filePath) {
      return NextResponse.json(errorResponse("Path tidak valid", 400), {
        status: 400,
      });
    }

    const cleanupToken = createCleanupToken(uniqueName, session.user.id);
    await writeFile(filePath, compressedBuffer);

    return NextResponse.json(
      {
        message: "Upload Berhasil",
        url: `/uploads/${uniqueName}`,
        publicId: uniqueName,
        cleanupToken,
        size: compressedBuffer.length,
      },
      { status: 200 },
    );
  } catch (e) {
    return handleApiError(e, "POST /api/upload");
  }
}

export async function DELETE(request: Request) {
  const rl = checkRateLimit(request, { keyPrefix: "upload-cleanup", max: 40 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  try {
    const session = await requireAuth();
    const body = await request.json().catch(() => null);
    const parsed = deleteUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(errorResponse("Data cleanup tidak valid", 400), {
        status: 400,
      });
    }

    const { publicId, cleanupToken } = parsed.data;
    if (!isValidCleanupToken(publicId, session.user.id, cleanupToken)) {
      return NextResponse.json(
        errorResponse("Kredensial cleanup tidak valid atau kedaluwarsa", 403),
        { status: 403 },
      );
    }

    if (await isUploadReferenced(publicId)) {
      return NextResponse.json({
        message: "File sudah digunakan dan tidak dihapus",
        deleted: false,
      });
    }

    const filePath = getUploadPath(publicId);
    if (!filePath) {
      return NextResponse.json(errorResponse("Path tidak valid", 400), {
        status: 400,
      });
    }

    try {
      await unlink(filePath);
      return NextResponse.json({
        message: "File sementara berhasil dihapus",
        deleted: true,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json({
          message: "File sementara sudah tidak tersedia",
          deleted: false,
        });
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error, "DELETE /api/upload");
  }
}
