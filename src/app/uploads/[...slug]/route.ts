import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

// Lokasi folder upload ASLI di server.
// Di server production, set env var UPLOAD_DIR=D:\aktivasi-budaya\uploads-bulog
// Di local development, fallback ke public/uploads seperti biasa.
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;

  // Gabungkan slug menjadi nama file, misal ["gambar.jpg"] → "gambar.jpg"
  const filename = slug.join("/");

  // Buat absolute path ke file
  const filePath = path.join(UPLOAD_DIR, filename);

  // ⛔ Security: Cegah path traversal attack (misal: ../../etc/passwd)
  const resolvedFilePath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!resolvedFilePath.startsWith(resolvedUploadDir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Cek apakah file benar-benar ada
  if (!fs.existsSync(resolvedFilePath)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(resolvedFilePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache 1 tahun di browser (file nama UUID tidak pernah berubah isinya)
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (e) {
    console.error("[GET /uploads] Error membaca file:", e);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
