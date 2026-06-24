import { errorResponse } from "@/lib/response";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";


export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(errorResponse("File wajib diisi", 400), {
        status: 400,
      });
    }

    const MAX_SIZE_BYTES = 2 * 1024 * 1024; // Maksimal 2MB
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        errorResponse(`File maksimal 2MB`, 400),
        { status: 400 },
      );
    }

    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(errorResponse(`Tipe file tidak didukung`, 400), {
        status: 400,
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Lokasi folder upload: baca dari env UPLOAD_DIR (server production)
    // atau fallback ke public/uploads (local development)
    const uploadDir =
      process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || ".jpg";
    const uniqueName = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${uniqueName}`;

    return NextResponse.json(
      {
        message: "Upload Berhasil",
        url: fileUrl,
        publicId: uniqueName,
        originalName: file.name,
      },
      { status: 200 },
    );
  } catch (e) {
    console.log(e);
    return NextResponse.json(errorResponse("Internal Server Error"), {
      status: 500,
    });
  }
}
