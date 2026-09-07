import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { errorResponse } from "../response";
import { evaluateAuthPolicy } from "../auth-policy";
import { prisma } from "../prisma";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requireCurrentAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ApiError("Unauthorized", 401);
  }

  const provider = session.user.authProvider;

  if (provider !== "SSO" && provider !== "LOCAL") {
    throw new ApiError("Unauthorized", 401);
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      authProvider: true,
      isActive: true,
      unitId: true,
      unit: {
        select: {
          id: true,
          name: true,
          type: true,
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      employee: {
        select: {
          jenjang: true,
          kodeStatpeg: true,
          statKepeg: true,
          isPresentInSource: true,
          unitId: true,
        },
      },
    },
  });

  if (!currentUser) {
    throw new ApiError("Unauthorized", 401);
  }

  const decision = evaluateAuthPolicy({
    provider,
    user: {
      role: currentUser.role,
      authProvider: currentUser.authProvider,
      isActive: currentUser.isActive,
      unitId: currentUser.unitId,
    },
    employee: currentUser.employee,
  });

  if (!decision.allowed) {
    throw new ApiError("Akun tidak memiliki akses aktif", 403);
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: currentUser.id,
      name: currentUser.name,
      username: currentUser.username ?? session.user.username,
      role: currentUser.role,
      unitId: currentUser.unitId,
      unitName: currentUser.unit?.name ?? null,
      unitType: currentUser.unit?.type ?? null,
      parentUnitId: currentUser.unit?.parent?.id ?? null,
      parentUnitName: currentUser.unit?.parent?.name ?? null,
      authProvider: currentUser.authProvider,
    },
  };
}

export async function requireAuth() {
  return requireCurrentAuth();
}

export async function requireAdmin() {
  const session = await requireCurrentAuth();

  if (session.user.role !== "ADMIN") {
    throw new ApiError("Hanya Admin yang dapat mengakses", 403);
  }

  return session;
}

export async function requirePic() {
  const session = await requireCurrentAuth();

  if (session.user.role !== "PIC") {
    throw new ApiError("Hanya PIC yang dapat mengakses fitur ini", 403);
  }

  return session;
}

export function handleApiError(
  error: unknown,
  logPrefix: string,
): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(errorResponse(error.message, error.status), {
      status: error.status,
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2002" || error.code === "P2034")
  ) {
    return NextResponse.json(
      errorResponse(
        error.code === "P2002"
          ? "Data dengan kombinasi ini sudah tersedia"
          : "Data sedang diperbarui oleh pengguna lain. Silakan coba lagi",
        409,
      ),
      { status: 409 },
    );
  }

  console.error(`[${logPrefix}] Internal Error:`, error);
  return NextResponse.json(
    errorResponse("Terjadi kesalahan internal pada server", 500),
    { status: 500 },
  );
}
