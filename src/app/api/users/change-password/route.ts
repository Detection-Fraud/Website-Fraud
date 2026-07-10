import { handleApiError, requireAuth } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/response";
import { changePasswordSchema } from "@/schemas/user.schema";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

/**
 * PATCH /api/users/change-password
 *
 * Guard:
 * 1. Harus login (requireAuth)
 * 2. Hanya authProvider="LOCAL" (SSO ganti password di IdP)
 * 3. Validasi password lama
 */
export async function PATCH(req: Request) {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true, authProvider: true },
    });

    if (!user) {
      return NextResponse.json(errorResponse("User tidak ditemukan", 404), {
        status: 404,
      });
    }

    if (user.authProvider !== "LOCAL") {
      return NextResponse.json(
        errorResponse("Tidak bisa mengubah password untuk user SSO", 403),
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json(errorResponse(msg, 400), { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;

    if (!user.password) {
      return NextResponse.json(
        errorResponse("Akun tidak memiliki password", 400),
        { status: 400 },
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json(errorResponse("Password lama salah", 400), {
        status: 400,
      });
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return NextResponse.json(
        errorResponse(
          "Password baru tidak boleh sama dengan password lama",
          400,
        ),
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    });

    return NextResponse.json(successResponse(null, "Password berhasil diubah"));
  } catch (error) {
    return handleApiError(error, "PATCH /api/users/change-password");
  }
}
