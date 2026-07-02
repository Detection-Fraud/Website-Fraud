import { handleApiError, requireAdmin } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { toggleUserStatusSchema } from "@/schemas/user.schema";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();

  const { id } = await params;
    const body = await req.json();
    const parsed = toggleUserStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0].message ?? "Validasi Gagal", 400),
        { status: 400 },
      );
    }

    const { isActive } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, isActive: true },
    });

    if (!existingUser) {
      return NextResponse.json(errorResponse("User tidak ditemukan", 404), {
        status: 404,
      });
    }

    if (existingUser.role !== "PIC") {
      return NextResponse.json(
        errorResponse("Hanya PIC yang dapat di nonaktifkan/aktifkan", 400),
        { status: 400 },
      );
    }

    if (existingUser.isActive === isActive) {
      return NextResponse.json(
        successResponse(
          null,
          `Status sudah ${isActive ? "Aktif" : "Nonaktif"}`,
        ),
        { status: 200 },
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    const statusText = updatedUser.isActive ? "diaktifkan" : "dinonaktifkan";

    return NextResponse.json(
      successResponse(
        updatedUser,
        `Akun ${updatedUser.name} berhasil ${statusText}`,
      ),
      { status: 200 },
    );
  } catch (error) {
    return handleApiError(error, "PATCH /api/users/[id]/status");
  }
}
