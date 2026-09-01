import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { errorResponse } from "../response";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ApiError("Unauthorized", 401);
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw new ApiError("Hanya Admin yang dapat mengakses", 403);
  }
  return session;
}

export async function requirePic() {
  const session = await requireAuth();
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
