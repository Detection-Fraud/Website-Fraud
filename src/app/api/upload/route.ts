import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { errorResponse } from "@/lib/response";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import sharp from "sharp";

export async function POST(request: Request) {
  const rl = checkRateLimit(request, { keyPrefix: "upload", max: 20 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);
  try {
    await requireAuth();

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

    const uploadDir =
      process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const uniqueName = `${randomUUID()}.jpg`;
    const filePath = path.join(uploadDir, uniqueName);

    const resolvedUploadDir = path.resolve(uploadDir);
    const resolvedFilePath = path.resolve(filePath);
    if (!resolvedFilePath.startsWith(resolvedUploadDir)) {
      return NextResponse.json(errorResponse("Path tidak valid", 400), {
        status: 400,
      });
    }

    await writeFile(filePath, compressedBuffer);

    return NextResponse.json(
      {
        message: "Upload Berhasil",
        url: `/uploads/${uniqueName}`,
        publicId: uniqueName,
        size: compressedBuffer.length,
      },
      { status: 200 },
    );
  } catch (e) {
    return handleApiError(e, "POST /api/upload");
  }
}
