import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { promoteUserSchema } from "@/schemas/user.schema";
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
    const parsed = promoteUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0]?.message ?? "Validasi gagal", 400),
        { status: 400 },
      );
    }

    const { unitId } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, unitId: true },
    });

    if (!existingUser) {
      return NextResponse.json(errorResponse("User not Found", 404), {
        status: 404,
      });
    }

    if (existingUser.role !== "VIEWER") {
      return NextResponse.json(
        errorResponse(
          `User ini sudah memiliki role ${existingUser.role}, tidak bisa dipromote ulang`,
          409,
        ),
        { status: 409 },
      );
    }

    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, name: true },
    });

    if (!unit) {
      return NextResponse.json(
        errorResponse("Unit kerja tidak ditemukan", 404),
        { status: 404 },
      );
    }

    const promotedUser = await prisma.user.update({
      where: { id },
      data: {
        role: "PIC",
        unitId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        unitId: true,
        unit: { select: { id: true, name: true, type: true } },
        createdAt: true,
      },
    });

    return NextResponse.json(
      successResponse(
        promotedUser,
        `${promotedUser.name} berhasil dipromote menjadi PIC ${unit.name}`,
      ),
      { status: 200 },
    );
  } catch (error) {
    console.error("[PATCH /api/users/[id]/promote] Error:", error);
    return NextResponse.json(errorResponse("Internal server error", 500), {
      status: 500,
    });
  }
}
