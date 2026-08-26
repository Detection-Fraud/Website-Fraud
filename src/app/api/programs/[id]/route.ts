import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import {
  toggleProgramSchema,
  updateProgramSchema,
} from "@/schemas/program.schema";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireAdmin();

    const body = await req.json();
    const parsedData = toggleProgramSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        errorResponse(
          "Validasi input gagal",
          400,
          z.treeifyError(parsedData.error),
        ),
        { status: 400 },
      );
    }

    const updateProgram = await prisma.programBudaya.update({
      where: { id },
      data: parsedData.data,
    });

    const statusText =
      parsedData.data.isActive === undefined
        ? "diupdate"
        : parsedData.data.isActive
          ? "diaktifkan"
          : "dinonaktifkan";

    return NextResponse.json(
      successResponse(updateProgram, `Program ${statusText} berhasil`),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "PATCH /api/programs/[id]");
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireAdmin();

    const body = await req.json();
    const parsedData = updateProgramSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        errorResponse(
          "Validasi input gagal",
          400,
          z.treeifyError(parsedData.error),
        ),
        { status: 400 },
      );
    }

    const {
      name,
      frequency,
      startDate,
      tw,
      endDate,
      uploadDeadline,
      categoryId,
      description,
      bannerUrl,
    } = parsedData.data;

    const conflictCount = await prisma.activityReport.count({
      where: {
        programId: id,
        OR: [
          { tanggalKegiatan: { lt: startDate } },
          { tanggalKegiatan: { gt: endDate } },
        ],
      },
    });

    if (conflictCount > 0) {
      return NextResponse.json(
        errorResponse(
          `Rentang baru bertabrakan dengan ${conflictCount} laporan lama`,
          409,
        ),
        { status: 409 },
      );
    }

    if (categoryId) {
      const category = await prisma.programCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return NextResponse.json(
          errorResponse("Kategori tidak ditemukan", 404),
          { status: 404 },
        );
      }

      if (category.targetUnit !== "KEGIATAN") {
        return NextResponse.json(
          errorResponse("Kategori program budaya harus bertipe KEGIATAN", 400),
          { status: 400 },
        );
      }
    }

    const program = await prisma.programBudaya.update({
      where: { id },
      data: {
        name,
        frequency,
        tw: tw ?? null,
        startDate,
        endDate,
        uploadDeadline,
        categoryId: categoryId || null,
        description: description || null,
        bannerUrl: bannerUrl || null,
      },
    });

    return NextResponse.json(
      successResponse(program, "Program berhasil diupdate"),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "PUT /api/programs/[id]");
  }
}
