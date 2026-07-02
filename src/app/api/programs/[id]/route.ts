import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { createProgramSchema, updateProgramSchema } from "@/schemas/program.schema";
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
    const parsedData = createProgramSchema.safeParse(body);

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

    const { name, frequency, startDate, endDate, categoryId, description } =
      parsedData.data;

    if (endDate <= startDate) {
      return NextResponse.json(
        errorResponse("End date must be after start date", 400),
        { status: 400 },
      );
    }

    const program = await prisma.programBudaya.update({
      where: { id },
      data: {
        name,
        frequency,
        startDate,
        endDate,
        categoryId: categoryId || null,
        description: description || null,
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
