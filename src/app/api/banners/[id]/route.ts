import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateBannerSchema = z.object({
  imageUrl: z.string().min(1).optional(),
  name: z.string().min(2).optional(),
  role: z.string().min(2).optional(),
  unit: z.string().min(2).optional(),
  period: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();

    const parsed = updateBannerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(errorResponse("Invalid input data", 400), {
        status: 400,
      });
    }

    const check = await prisma.loginBanner.findUnique({
      where: { id },
    });

    if (!check) {
      return NextResponse.json(errorResponse("Banner tidak ditemukan", 404), {
        status: 404,
      });
    }

    const updated = await prisma.loginBanner.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(
      successResponse(updated, "Banner berhasil diupdate"),
    );
  } catch (error) {
    return handleApiError(error, "PATCH /api/banners/[id]");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { id } = await params;

    const check = await prisma.loginBanner.findUnique({
      where: { id },
    });

    if (!check) {
      return NextResponse.json(errorResponse("Banner tidak ditemukan", 404), {
        status: 404,
      });
    }

    await prisma.loginBanner.delete({
      where: { id },
    });

    return NextResponse.json(successResponse(null, "Banner berhasil dihapus"));
  } catch (error) {
    return handleApiError(error, "DELETE /api/banners/[id]");
  }
}
