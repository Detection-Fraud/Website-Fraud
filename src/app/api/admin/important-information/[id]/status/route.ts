import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import {
  importantInformationIdSchema,
  importantInformationStatusSchema,
} from "@/schemas/important-information.schema";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        errorResponse("Payload JSON tidak valid", 400),
        { status: 400 },
      );
    }
    const parsedBody = importantInformationStatusSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        errorResponse(
          parsedBody.error.issues[0]?.message ?? "Status aktif tidak valid",
          400,
        ),
        { status: 400 },
      );
    }

    const existing = await prisma.picImportantInformation.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse("Informasi Penting tidak ditemukan", 404),
        { status: 404 },
      );
    }

    const updated = await prisma.picImportantInformation.update({
      where: { id },
      data: { isActive: parsedBody.data.isActive },
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

    return NextResponse.json(
      successResponse(
        {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
        "Status Informasi Penting berhasil diperbarui",
      ),
    );
  } catch (error) {
    return handleApiError(
      error,
      "PATCH /api/admin/important-information/[id]/status",
    );
  }
}
