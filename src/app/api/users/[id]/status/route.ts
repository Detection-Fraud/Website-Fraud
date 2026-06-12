import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { toggleUserStatusSchema } from "@/schemas/user.schema";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = session?.user;

  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json(errorResponse("Forbidden", 403), { status: 403 });
  }

  const { id } = await params;

  try {
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
    console.error("[PATCH /api/users/[id]/status] Error:", error);
    return NextResponse.json(errorResponse("Internal server error", 500), {
      status: 500,
    });
  }
}

