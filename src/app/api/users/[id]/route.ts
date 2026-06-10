import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/response";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  const user = session?.user;

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(errorResponse("Forbidden", 403), { status: 403 });
  }

  const { id } = await params;

  try {
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
  } catch (err) {
    console.log(err);
    return NextResponse.json(errorResponse("Internal Server Error", 500), {
      status: 500,
    });
  }
}
