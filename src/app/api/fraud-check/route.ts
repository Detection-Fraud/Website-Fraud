import { ApiError, handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { checkRateLimit, getTrustedClientIdentity, rateLimitResponse } from "@/lib/api/rate-limit";
import { resolveScope } from "@/lib/api/unit-scope";
import { resolveUploadReference } from "@/lib/api/upload-storage";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextResponse } from "next/server";
import { pathToFileURL } from "url";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;

async function readBoundedFormData(request: Request): Promise<FormData> {
  if (!request.body) throw new ApiError("Foto baru wajib diisi", 400);
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ApiError("Ukuran permintaan maksimal 5MB", 413);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new ApiError("Format upload tidak valid", 400);
  }
}

export async function POST(request: Request) {
  // Coarse ingress protection; the user's quota is checked after authentication.
  const rl = checkRateLimit(request, {
    keyPrefix: "fraud-check-ingress",
    clientIdentity: getTrustedClientIdentity(request) ?? "unknown-ingress",
    max: 600,
  });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  try {
    const session = await requireAuth();
    const user = session.user;
    const userLimit = checkRateLimit(request, {
      keyPrefix: "fraud-check-user",
      clientIdentity: user.id,
      max: 5,
    });
    if (!userLimit.success) return rateLimitResponse(userLimit.resetAt);

    const formData = await readBoundedFormData(request);
    const fotoBaruFiles = formData.getAll("foto_baru");

    if (!fotoBaruFiles || fotoBaruFiles.length === 0) {
      return NextResponse.json(errorResponse("Foto baru wajib diisi", 400), {
        status: 400,
      });
    }

    if (fotoBaruFiles.length > 2 || !fotoBaruFiles.every((file): file is File => file instanceof File)) {
      throw new ApiError("Maksimal 2 file gambar per pemeriksaan", 400);
    }
    if (fotoBaruFiles.some((file) => file.size > MAX_IMAGE_BYTES)) {
      throw new ApiError("Ukuran setiap gambar maksimal 2MB", 413);
    }
    if (fotoBaruFiles.some((file) => file.size === 0 || !file.type.startsWith("image/"))) {
      throw new ApiError("File gambar tidak valid", 400);
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
      take: 500,
      orderBy: { id: "desc" },
    });

    const urlMapping: Record<string, string> = {};

    const referencesJson = (
      await Promise.all(
        references.map(async (item) => {
          try {
            const resolved = await resolveUploadReference(item.imageUrl);
            if (
              resolved.kind === "local" &&
              resolved.exists &&
              resolved.isRegularFile
            ) {
              const fileUrl = pathToFileURL(resolved.filePath).href;
              urlMapping[fileUrl] = item.imageUrl;
              return { nama_asli: item.originalName, url: fileUrl };
            }
            if (resolved.kind === "external-http") {
              urlMapping[resolved.url] = item.imageUrl;
              return { nama_asli: item.originalName, url: resolved.url };
            }
            return null;
          } catch {
            return null;
          }
        }),
      )
    ).filter(
      (item): item is { nama_asli: string; url: string } => item !== null,
    );

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
      const headers = new Headers();
      if (pythonResponse.status === 429) {
        const retryAfter = pythonResponse.headers.get("Retry-After")?.trim();
        if (retryAfter && /^(?:[1-9]|[1-5]\d|60)$/.test(retryAfter)) {
          headers.set("Retry-After", retryAfter);
        }
      }

      return NextResponse.json(
        errorResponse(
          "Gagal memproses data di Python AI",
          pythonResponse.status,
        ),
        {
          status: pythonResponse.status,
          headers,
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
