import { ApiError, handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  getCapabilityError,
  usesDirectAdminScore,
} from "@/lib/program-capabilities";
import { errorResponse, successResponse } from "@/lib/response";
import {
  createProgramSchema,
  toggleProgramSchema,
  updateProgramSchema,
} from "@/schemas/program.schema";
import { Prisma } from "@generated/prisma";
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
    const parsedData = updateProgramSchema.safeParse(await req.json());
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
    const existingProgram = await prisma.programBudaya.findUnique({
      where: { id },
    });
    if (!existingProgram) {
      return NextResponse.json(errorResponse("Program tidak ditemukan", 404), {
        status: 404,
      });
    }

    const data = parsedData.data;
    const mergedValidation = createProgramSchema.safeParse({
      name: data.name ?? existingProgram.name,
      description:
        data.description !== undefined
          ? data.description
          : existingProgram.description,
      bannerUrl:
        data.bannerUrl !== undefined
          ? data.bannerUrl
          : existingProgram.bannerUrl,
      frequency: data.frequency ?? existingProgram.frequency,
      tw: data.tw !== undefined ? data.tw : existingProgram.tw,
      startDate: data.startDate ?? existingProgram.startDate,
      endDate: data.endDate ?? existingProgram.endDate,
      uploadDeadline:
        data.uploadDeadline ?? existingProgram.uploadDeadline,
      categoryId:
        data.categoryId !== undefined
          ? data.categoryId
          : existingProgram.categoryId,
    });
    if (!mergedValidation.success) {
      return NextResponse.json(
        errorResponse(
          "Validasi input gagal",
          400,
          z.treeifyError(mergedValidation.error),
        ),
        { status: 400 },
      );
    }

    const {
      name: finalName,
      description: finalDescription,
      bannerUrl: finalBannerUrl,
      frequency: requestedFrequency,
      tw: finalTw,
      startDate: finalStartDate,
      endDate: finalEndDate,
      uploadDeadline: finalUploadDeadline,
      categoryId: finalCategoryId,
    } = mergedValidation.data;
    let finalFrequency = requestedFrequency;

    if (finalCategoryId !== existingProgram.categoryId) {
      const existingReportsCount = await prisma.activityReport.count({
        where: { programId: id },
      });
      if (existingReportsCount > 0) {
        return NextResponse.json(
          errorResponse(
            "Kategori program tidak dapat diubah karena sudah memiliki laporan kegiatan",
            409,
          ),
          { status: 409 },
        );
      }
    }

    const conflictCount = await prisma.activityReport.count({
      where: {
        programId: id,
        OR: [
          { tanggalKegiatan: { lt: finalStartDate } },
          { tanggalKegiatan: { gt: finalEndDate } },
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

    const updatedProgram = await prisma.$transaction(
      async (tx) => {
        if (finalCategoryId) {
          const category = await tx.programCategory.findUnique({
            where: { id: finalCategoryId },
          });
          if (!category) {
            throw new ApiError("Kategori tidak ditemukan", 404);
          }
          const capabilityError = getCapabilityError(category);
          if (capabilityError) {
            throw new ApiError(capabilityError, 422);
          }
          const isDirectAdmin = usesDirectAdminScore(category);
          if (isDirectAdmin) {
            if (finalTw === null || finalTw < 1 || finalTw > 4) {
              throw new ApiError(
                "Program penilaian langsung wajib memiliki TW 1-4",
                422,
              );
            }
            finalFrequency = 1;
            const normalizedStartDate = new Date(finalStartDate);
            const year = normalizedStartDate.getUTCFullYear();
            await tx.$queryRaw(
              Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`direct-program:${finalCategoryId}:${year}:${finalTw}`}))::text`,
            );
            const duplicate = await tx.programBudaya.findFirst({
              where: {
                id: { not: id },
                categoryId: finalCategoryId,
                tw: finalTw,
                startDate: {
                  gte: new Date(Date.UTC(year, 0, 1)),
                  lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
                },
              },
              select: { id: true },
            });
            if (duplicate) {
              throw new ApiError(
                "Program penilaian langsung untuk kategori, tahun, dan TW ini sudah ada",
                409,
              );
            }
          }
        }
        return await tx.programBudaya.update({
          where: { id },
          data: {
            name: finalName,
            frequency: finalFrequency,
            tw: finalTw,
            startDate: finalStartDate,
            endDate: finalEndDate,
            uploadDeadline: finalUploadDeadline,
            categoryId: finalCategoryId,
            description: finalDescription,
            bannerUrl: finalBannerUrl,
          },
          include: { category: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      successResponse(updatedProgram, "Program berhasil diupdate"),
      {
        status: 200,
      },
    );
  } catch (error) {
    return handleApiError(error, "PUT /api/programs/[id]");
  }
}
