import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import {
  getImportantInformationOrderState,
  lockImportantInformationOrder,
  sortImportantInformation,
} from "@/lib/api/important-information-order";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { importantInformationReorderSchema } from "@/schemas/important-information.schema";
import { Prisma } from "@generated/prisma";
import { NextResponse } from "next/server";

class OrderConflict extends Error {
  constructor(public readonly currentRevision: number) {
    super("Order conflict");
  }
}

const ITEM_SELECT = {
  id: true,
  imageUrl: true,
  altText: true,
  width: true,
  height: true,
  order: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function orderConflict(currentRevision: number) {
  return NextResponse.json(
    errorResponse(
      "Urutan berubah. Muat ulang daftar sebelum mencoba lagi",
      409,
      {
        code: "ORDER_CONFLICT",
        currentRevision,
      },
    ),
    { status: 409 },
  );
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        errorResponse("Payload reorder tidak valid", 400),
        { status: 400 },
      );
    }
    const parsed = importantInformationReorderSchema.safeParse(body);
    if (!parsed.success) {
      const duplicate =
        typeof body === "object" &&
        body !== null &&
        "ids" in body &&
        Array.isArray(body.ids) &&
        new Set(body.ids).size !== body.ids.length;

      if (duplicate) {
        const state = await prisma.$transaction(
          async (tx) => {
            await lockImportantInformationOrder(tx);
            return getImportantInformationOrderState(tx);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return orderConflict(state.revision);
      }
      return NextResponse.json(
        errorResponse("Payload reorder tidak valid", 400),
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        await lockImportantInformationOrder(tx);
        const state = await getImportantInformationOrderState(tx);
        const current = await tx.picImportantInformation.findMany({
          select: ITEM_SELECT,
        });

        if (parsed.data.revision !== state.revision)
          throw new OrderConflict(state.revision);
        const submitted = new Set(parsed.data.ids);
        const currentIds = new Set(current.map((item) => item.id));
        if (
          submitted.size !== parsed.data.ids.length ||
          submitted.size !== currentIds.size ||
          [...currentIds].some((id) => !submitted.has(id)) ||
          [...submitted].some((id) => !currentIds.has(id))
        )
          throw new OrderConflict(state.revision);
        for (const [order, id] of parsed.data.ids.entries())
          await tx.picImportantInformation.update({
            where: { id },
            data: { order },
          });
        const next = await tx.picImportantInformationOrderState.update({
          where: { id: "global" },
          data: { revision: state.revision + 1 },
        });
        const items = sortImportantInformation(
          await tx.picImportantInformation.findMany({ select: ITEM_SELECT }),
        ).map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        }));

        return { items, revision: next.revision };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      successResponse(result, "Urutan Informasi Penting berhasil diperbarui"),
    );
  } catch (error) {
    if (error instanceof OrderConflict)
      return orderConflict(error.currentRevision);
    return handleApiError(
      error,
      "PUT /api/admin/important-information/reorder",
    );
  }
}
