import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { resolveScope } from "@/lib/api/unit-scope";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";
import path from "path";
import { pathToFileURL } from "url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const user = session.user;

    const formData = await request.formData();
    const fotoBaruFiles = formData.getAll("foto_baru");

    if (!fotoBaruFiles || fotoBaruFiles.length === 0) {
      return NextResponse.json(
        {
          status: 400,
          error: true,
          message: "Foto baru wajib diisi",
          data: null,
        },
        { status: 400 },
      );
    }

    const { whereClause: reportWhereClause } = await resolveScope(user, {});

    const references = await prisma.activityPhoto.findMany({
      where: {
        report: reportWhereClause,
      },
      select: {
        originalName: true,
        imageUrl: true,
      },
    });

    const urlMapping: Record<string, string> = {};

    const referencesJson = references.map((item) => {
      let fileUrl = item.imageUrl;

      // Jika URL relatif (seperti /uploads/filename.jpg), ubah jadi file:/// local path!
      // Python akan baca langsung dari disk → tidak perlu HTTP download, anti-gagal
      if (!fileUrl.startsWith("http")) {
        try {
          const filename = fileUrl.replace(/^\/uploads\//, "");

          // Gunakan UPLOAD_DIR env var agar bisa baca dari folder symlink/junction
          // maupun dari folder langsung (production vs local)
          const uploadBase =
            process.env.UPLOAD_DIR ||
            path.join(process.cwd(), "public", "uploads");

          const localPath = path.join(uploadBase, filename);
          fileUrl = pathToFileURL(localPath).href;
        } catch (e) {
          fileUrl = `${BASE_URL}${fileUrl}`; // fallback ke HTTP
        }
      }

      // Simpan mapping agar saat Python mengembalikan file:/// bisa dikembalikan ke /uploads/
      urlMapping[fileUrl] = item.imageUrl;

      return {
        nama_asli: item.originalName,
        url: fileUrl,
      };
    });

    const pythonFormData = new FormData();

    fotoBaruFiles.forEach((file) => {
      pythonFormData.append("foto_baru", file);
    });

    pythonFormData.append("referensi_json", JSON.stringify(referencesJson));

    const PYTHON_API_URL = process.env.PYTHON_API_URL;

    if (!PYTHON_API_URL) {
      return NextResponse.json(
        errorResponse("Konfigurasi Python API URL tidak ditemukan", 500),
        {
          status: 500,
        },
      );
    }

    const PYTHON_API_KEY = process.env.PYTHON_API_KEY;
    if (!PYTHON_API_KEY) {
      return NextResponse.json(
        errorResponse("Konfigurasi Python API Key tidak ditemukan", 500),
        {
          status: 500,
        },
      );
    }

    const pythonResponse = await fetch(PYTHON_API_URL, {
      method: "POST",
      headers: {
        "X-API-Key": PYTHON_API_KEY,
      },
      body: pythonFormData,
    });

    if (!pythonResponse.ok) {
      return NextResponse.json(
        errorResponse("Gagal memproses data di Python AI", 500),
        {
          status: pythonResponse.status,
        },
      );
    }

    const result = await pythonResponse.json();

    // Map the file:/// URLs back to the original relative URLs
    if (result && Array.isArray(result.detail_gambar)) {
      result.detail_gambar = result.detail_gambar.map((item: any) => {
        if (
          item.url_referensi_pelaku &&
          urlMapping[item.url_referensi_pelaku]
        ) {
          item.url_referensi_pelaku = urlMapping[item.url_referensi_pelaku];
        }
        return item;
      });
    }

    return NextResponse.json(successResponse(result, "Data berhasil dicek"), {
      status: 200,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/fraud-check");
  }
}
