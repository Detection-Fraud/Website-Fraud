import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import {
  getImportantInformationOrderState,
  lockImportantInformationOrder,
  sortImportantInformation,
} from "@/lib/api/important-information-order";
import {
  ImportantInformationStorageError,
  ImportantInformationStoredImage,
  deleteImportantInformationImage,
  rollbackImportantInformationImage,
  validateAndStoreImportantInformationImage,
} from "@/lib/api/important-information-storage";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import {
  ImportantInformationFormData,
  importantInformationIdSchema,
  parseImportantInformationFormData,
} from "@/schemas/important-information.schema";
import { Prisma } from "@generated/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let stored: ImportantInformationStoredImage | undefined;
  try {
    await requireAdmin();
    const { id } = await params;

    const parsedId = importantInformationIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        errorResponse("ID Informasi Penting tidak valid", 400),
        { status: 400 },
      );
    }

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

    let form: ImportantInformationFormData;
    try {
      form = parseImportantInformationFormData(formData, {
        requireFile: false,
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

    const existing = await prisma.picImportantInformation.findUnique({
      where: { id },
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
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse("Informasi Penting tidak ditemukan", 404),
        { status: 404 },
      );
    }

    if (form.file) {
      try {
        stored = await validateAndStoreImportantInformationImage(form.file);
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
    }

    try {
      const updated = await prisma.picImportantInformation.update({
        where: { id },
        data: stored
          ? { altText: form.altText, ...stored }
          : { altText: form.altText },
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
      });

      if (stored) {
        await deleteImportantInformationImage(existing.imageUrl).catch(
          (err) => {
            console.error(
              "[important-information] old image cleanup failed",
              err,
            );
          },
        );
      }

      return NextResponse.json(
        successResponse(
          {
            ...updated,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          },
          "Informasi Penting berhasil diperbarui",
        ),
      );
    } catch (error) {
      if (stored) {
        await rollbackImportantInformationImage(stored.imageUrl).catch(
          () => {},
        );
      }
      return handleApiError(
        error,
        "PATCH /api/admin/important-information/[id]",
      );
    }
  } catch (error) {
    if (stored) {
      await rollbackImportantInformationImage(stored.imageUrl).catch(() => {});
    }
    return handleApiError(error, "PATCH /api/admin/important-information/[id]");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const parsedId = importantInformationIdSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        errorResponse("ID Informasi Penting tidak valid", 400),
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        await lockImportantInformationOrder(tx);
        const existing = await tx.picImportantInformation.findUnique({
          where: { id },
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
        });

        if (!existing) {
          throw new ApiError("Informasi Penting tidak ditemukan", 404);
        }

        await tx.picImportantInformation.delete({ where: { id } });

        const rawItems = await tx.picImportantInformation.findMany({
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
        });

        const sorted = sortImportantInformation(rawItems);
        for (const [order, item] of sorted.entries()) {
          await tx.picImportantInformation.update({
            where: { id: item.id },
            data: { order },
          });
          item.order = order;
        }

        const state = await getImportantInformationOrderState(tx);
        const next = await tx.picImportantInformationOrderState.update({
          where: { id: "global" },
          data: { revision: state.revision + 1 },
        });

        return {
          items: sorted.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })),
          revision: next.revision,
          imageUrl: existing.imageUrl,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await deleteImportantInformationImage(result.imageUrl).catch((error) =>
      console.error("[important-information] cleanup failed", error),
    );

    return NextResponse.json(
      successResponse(
        { items: result.items, revision: result.revision },
        "Informasi Penting berhasil dihapus",
      ),
    );
  } catch (error) {
    return handleApiError(
      error,
      "DELETE /api/admin/important-information/[id]",
    );
  }
}
