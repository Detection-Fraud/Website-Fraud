import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Array ID tidak boleh kosong"),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const parsed = reorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message, 400),
        { status: 400 },
      );
    }

    const { ids } = parsed.data;

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.loginBanner.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return NextResponse.json(
      successResponse(null, "Urutan banner berhasil diperbarui"),
    );
  } catch (error) {
    return handleApiError(error, "POST /api/banners/reorder");
  }
}
