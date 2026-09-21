import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";

import { resolvePublicUploadPath } from "@/lib/api/upload-storage";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  try {
    const { slug } = await params;
    const resolution = await resolvePublicUploadPath(slug);

    if (resolution.kind === "unsafe") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (resolution.kind === "missing") {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (resolution.kind === "error") {
      return new NextResponse("Internal Server Error", { status: 500 });
    }

    const fileBuffer = await readFile(resolution.filePath);
    const ext = path.extname(resolution.storageKey).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse("Not Found", { status: 404 });
    }

    console.error("[GET /uploads] Error membaca file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
