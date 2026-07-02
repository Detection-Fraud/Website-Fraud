import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();

  const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return NextResponse.json(errorResponse("User tidak ditemukan", 404), {
        status: 404,
      });
    }

    await prisma.user.update({
      where: { id },
      data: {
        role: "VIEWER",
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User berhasil dihapus",
    });
  } catch (error) {
    return handleApiError(error, "DELETE /api/users/[id]");
  }
}
