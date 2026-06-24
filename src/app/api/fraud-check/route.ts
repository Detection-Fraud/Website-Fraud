import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";
import path from "path";
import { pathToFileURL } from "url";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
export async function POST(request: Request) {
  try {
    const session = await auth();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(errorResponse("Unauthorized", 401), {
        status: 401,
      });
    }

    const formData = await request.formData();
    const fotoBaruFiles = formData.getAll("foto_baru");

    if (!fotoBaruFiles || fotoBaruFiles.length === 0) {
      return NextResponse.json(errorResponse("Foto baru wajib diisi", 400), {
        status: 400,
      });
    }

    let reportWhereClause: Record<string, unknown> = {};

    switch (user.role) {
      case "ADMIN":
        break;
      case "PIC":
        if (user.unitId) {
          if (user.unitType === "KANTOR_WILAYAH") {
            const childIds = await prisma.unit.findMany({
              where: { parentId: user.unitId },
              select: { id: true },
            });
            reportWhereClause = {
              unitId: {
                in: [user.unitId, ...childIds.map((c) => c.id)],
              },
            };
          } else {
            reportWhereClause = { unitId: user.unitId };
          }
        }
        break;
      case "VIEWER":
        break;
      default:
        return NextResponse.json(
          errorResponse("Akses ditolak - Role tidak dikenali", 403),
          { status: 403 },
        );
    }

    const references = await prisma.activityPhoto.findMany({
      where: {
        report: reportWhereClause,
      },
      select: {
        originalName: true,
        imageUrl: true,
      },
    });

    console.log(`Ditemukan ${references.length} foto referensi untuk dicek`);

    const referencesJson = references.map((item) => {
      let fileUrl = item.imageUrl;

      // Jika URL relatif (seperti /uploads/filename.jpg), ubah jadi file:/// local path!
      // Python akan baca langsung dari disk → tidak perlu HTTP download, anti-gagal
      if (!fileUrl.startsWith("http")) {
        try {
          // Ekstrak nama file dari URL: "/uploads/abc.jpg" → "abc.jpg"
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

    console.log("Mengirim data ke Python AI...");
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

    console.log(result);

    return NextResponse.json(successResponse(result, "Data berhasil dicek"), {
      status: 200,
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}
