import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";

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
        // Admin bisa cek fraud terhadap semua foto
        break;
      case "PIC":
        // PIC hanya cek fraud dari foto di level penempatannya
        if (user.branchId) {
          reportWhereClause = { branchId: user.branchId };
        } else if (user.regionId) {
          reportWhereClause = { regionId: user.regionId, branchId: null };
        } else if (user.divisionId) {
          reportWhereClause = { divisionId: user.divisionId };
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

    const referencesJson = references.map((item) => ({
      nama_asli: item.originalName,
      url: item.imageUrl.startsWith("http")
        ? item.imageUrl
        : `${BASE_URL}${item.imageUrl}`,
    }));

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
