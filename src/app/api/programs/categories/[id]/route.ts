import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { getCapabilityError } from "@/lib/program-capabilities";
import { errorResponse, successResponse } from "@/lib/response";
import { updateCategorySchema } from "@/schemas/program.schema";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();

    const { id } = await params;
    const parsed = updateCategorySchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse("Validasi gagal", 400, z.treeifyError(parsed.error)),
        { status: 400 },
      );
    }

    const current = await prisma.programCategory.findUnique({ where: { id } });

    if (!current) {
      return NextResponse.json(errorResponse("Kategori tidak ditemukan", 404), {
        status: 404,
      });
    }

    const merged = {
      targetUnit: parsed.data.targetUnit ?? current.targetUnit,
      evidenceMode: parsed.data.evidenceMode ?? current.evidenceMode,
      scoreInputMode: parsed.data.scoreInputMode ?? current.scoreInputMode,
    };

    const capabilityError = getCapabilityError(merged);
    if (capabilityError)
      return NextResponse.json(errorResponse(capabilityError, 422), {
        status: 422,
      });

    const capabilityChanges =
      merged.targetUnit !== current.targetUnit ||
      merged.evidenceMode !== current.evidenceMode ||
      merged.scoreInputMode !== current.scoreInputMode;

    if (capabilityChanges) {
      const [programCount, reportCount, participationCount, historyCount] =
        await Promise.all([
          prisma.programBudaya.count({ where: { categoryId: id } }),
          prisma.activityReport.count({
            where: { program: { categoryId: id } },
          }),
          prisma.participationData.count({ where: { categoryId: id } }),
          prisma.participationScoreHistory.count({ where: { categoryId: id } }),
        ]);
      if (programCount + reportCount + participationCount + historyCount > 0) {
        return NextResponse.json(
          errorResponse(
            "Kapabilitas kategori tidak dapat diubah karena sudah memiliki program, laporan, data partisipasi, atau riwayat skor",
            409,
            { programCount, reportCount, participationCount, historyCount },
          ),
          { status: 409 },
        );
      }
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
    const [programCount, reportCount, participationCount, historyCount] =
      await Promise.all([
        prisma.programBudaya.count({ where: { categoryId: id } }),
        prisma.activityReport.count({ where: { program: { categoryId: id } } }),
        prisma.participationData.count({ where: { categoryId: id } }),
        prisma.participationScoreHistory.count({ where: { categoryId: id } }),
      ]);

    if (programCount + reportCount + participationCount + historyCount > 0) {
      return NextResponse.json(
        errorResponse(
          "Kategori tidak dapat dihapus karena masih memiliki data terkait",
          409,
          { programCount, reportCount, participationCount, historyCount },
        ),
        { status: 409 },
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
