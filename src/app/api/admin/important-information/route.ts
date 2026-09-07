import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import {
  getImportantInformationOrderState,
  lockImportantInformationOrder,
  sortImportantInformation,
} from "@/lib/api/important-information-order";
import {
  ImportantInformationStorageError,
  ImportantInformationStoredImage,
  rollbackImportantInformationImage,
  validateAndStoreImportantInformationImage,
} from "@/lib/api/important-information-storage";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import {
  ImportantInformationFormData,
  parseImportantInformationFormData,
} from "@/schemas/important-information.schema";
import { Prisma } from "@generated/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAdmin();

    const [rawItems, state] = await Promise.all([
      prisma.picImportantInformation.findMany({
        select: {
          id: true,
          imageUrl: true,
          altText: true,
          width: true,
          height: true,
          order: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      getImportantInformationOrderState(prisma),
    ]);

    const sortedItems = sortImportantInformation(rawItems);
    const items = sortedItems.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return NextResponse.json(
      successResponse({
        items,
        revision: state.revision,
      }),
    );
  } catch (error) {
    return handleApiError(error, "GET /api/admin/important-information");
  }
}

export async function POST(req: Request) {
  let storedImageUrl: string | null = null;
  try {
    await requireAdmin();

    if (!req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      return NextResponse.json(
        errorResponse("Request harus menggunakan multipart/form-data", 400),
        { status: 400 },
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        errorResponse("Malformed multipart/form-data payload", 400),
        { status: 400 },
      );
    }

    let parsed: ImportantInformationFormData;
    try {
      parsed = parseImportantInformationFormData(formData, {
        requireFile: true,
      });
    } catch (err) {
      return NextResponse.json(
        errorResponse(
          err instanceof Error ? err.message : "Data form tidak valid",
          400,
        ),
        { status: 400 },
      );
    }

    if (!parsed.file) {
      return NextResponse.json(
        errorResponse("File gambar wajib diunggah", 400),
        { status: 400 },
      );
    }

    let stored: ImportantInformationStoredImage;
    try {
      stored = await validateAndStoreImportantInformationImage(parsed.file);
      storedImageUrl = stored.imageUrl;
    } catch (err) {
      if (err instanceof ImportantInformationStorageError) {
        const status =
          err.code === "size" ? 413 : err.code === "decode" ? 422 : 400;
        return NextResponse.json(errorResponse(err.message, status), {
          status,
        });
      }
      throw err;
    }

    const created = await prisma.$transaction(
      async (tx) => {
        await lockImportantInformationOrder(tx);
        const current = await tx.picImportantInformation.findMany({
          select: { order: true },
        });
        const state = await getImportantInformationOrderState(tx);

        const nextOrder =
          current.length === 0
            ? 0
            : Math.max(...current.map((row) => row.order)) + 1;

        const item = await tx.picImportantInformation.create({
          data: {
            imageUrl: stored.imageUrl,
            altText: parsed.altText,
            width: stored.width,
            height: stored.height,
            order: nextOrder,
            isActive: false,
          },
        });

        await tx.picImportantInformationOrderState.update({
          where: { id: "global" },
          data: { revision: state.revision + 1 },
        });

        return item;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      successResponse(
        {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
        "Informasi penting berhasil ditambahkan",
      ),
      { status: 201 },
    );
  } catch (error) {
    if (storedImageUrl) {
      await rollbackImportantInformationImage(storedImageUrl).catch(() => {});
    }
    return handleApiError(error, "POST /api/admin/important-information");
  }
}
