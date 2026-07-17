import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();

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
      data: body,
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
