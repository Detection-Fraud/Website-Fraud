import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import {
  getUploadLifecycleTransaction,
  matchesExpectedUpdatedAt,
  parseExpectedUpdatedAt,
  withUploadLifecycleTransaction,
} from "@/lib/api/upload-lifecycle";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { Prisma } from "@generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const reorderSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["up", "down"]),
  expectedUpdatedAt: z.string().datetime(),
});

// The sentinel sorts before UUID row IDs, so every collection writer locks it first.
const LOGIN_BANNER_COLLECTION_LOCK = "0";
const BANNER_BATCH_SIZE = 100;

function parseBannerVersion(value: string): Date {
  try {
    return parseExpectedUpdatedAt(value);
  } catch {
    throw new ApiError("Versi data tidak valid", 400);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = reorderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
        { status: 400 },
      );
    }

    const { id, direction, expectedUpdatedAt } = parsed.data;
    parseBannerVersion(expectedUpdatedAt);
    const boundary = await withUploadLifecycleTransaction(
      prisma,
      {
        entities: [
          { model: "LoginBanner", id: LOGIN_BANNER_COLLECTION_LOCK },
          { model: "LoginBanner", id },
        ],
        fileKeys: [],
      },
      async (lifecycle) => {
        const tx = getUploadLifecycleTransaction(lifecycle);
        const rows: { id: string; order: number; updatedAt: Date }[] = [];
        for (let skip = 0; ; skip += BANNER_BATCH_SIZE) {
          const batch = await tx.$queryRaw<typeof rows>(Prisma.sql`
            SELECT "id", "order", "updatedAt" FROM "LoginBanner"
            ORDER BY "order" ASC, "id" ASC
            LIMIT ${BANNER_BATCH_SIZE} OFFSET ${skip} FOR UPDATE
          `);
          rows.push(...batch);
          if (batch.length < BANNER_BATCH_SIZE) break;
        }

        const targetIndex = rows.findIndex((row) => row.id === id);
        if (targetIndex < 0) throw new ApiError("Banner tidak ditemukan", 404);
        const target = rows[targetIndex];
        if (!matchesExpectedUpdatedAt(expectedUpdatedAt, target.updatedAt)) {
          throw new ApiError(
            "Banner telah berubah. Muat ulang sebelum mengurutkan.",
            409,
          );
        }
        const neighborIndex = targetIndex + (direction === "up" ? -1 : 1);
        if (neighborIndex < 0 || neighborIndex >= rows.length) return true;
        [rows[targetIndex], rows[neighborIndex]] = [rows[neighborIndex], rows[targetIndex]];

        const changed = rows
          .map((row, index) => ({ row, order: index }))
          .filter(({ row, order }) => row.order !== order || row.id === id);
        const now = Date.now();
        for (const { row, order } of changed) {
          const updatedAt = new Date(Math.max(now, row.updatedAt.getTime() + 1));
          const result = await tx.loginBanner.updateMany({
            where: { id: row.id, updatedAt: row.updatedAt },
            data: { order, updatedAt },
          });
          if (result.count !== 1) {
            throw new ApiError(
              "Banner telah berubah. Muat ulang sebelum mengurutkan.",
              409,
            );
          }
        }
        return false;
      },
    );

    return NextResponse.json(
      successResponse(
        null,
        boundary ? "Banner sudah berada di batas urutan" : "Urutan banner berhasil diperbarui",
      ),
    );
  } catch (error) {
    return handleApiError(error, "POST /api/banners/reorder");
  }
}
