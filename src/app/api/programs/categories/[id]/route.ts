import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { updateCategorySchema } from "@/schemas/program.schema";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();

    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse("Validasi gagal", 400, z.treeifyError(parsed.error)),
        { status: 400 },
      );
    }

    const category = await prisma.programCategory.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(
      successResponse(category, "success update category"),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "PUT /api/programs/categories/[id]");
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();

    const { id } = await params;

    const programCount = await prisma.programBudaya.count({
      where: { categoryId: id },
    });

    if (programCount > 0) {
      return NextResponse.json(
        errorResponse(
          `Kategori masih digunakan oleh ${programCount} program`,
          400,
        ),
        { status: 400 },
      );
    }

    await prisma.programCategory.delete({
      where: { id },
    });

    return NextResponse.json(successResponse(null, "success delete category"), {
      status: 200,
    });
  } catch (error) {
    return handleApiError(error, "DELETE /api/programs/categories/[id]");
  }
}
