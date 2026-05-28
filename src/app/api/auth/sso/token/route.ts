import { consumeToken } from "@/lib/sso-token-store";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("sso_temp_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Token tidak ditemukan atau sudah expired" },
      { status: 401 },
    );
  }

  const isFirstUse = consumeToken(token);

  if (!isFirstUse) {
    console.warn(
      "[SSO TOKEN] Replay attempt detected - token sudah pernah dikonsumsi",
    );

    const errorResponse = NextResponse.json(
      { error: "Token sudah pernah digunakan" },
      { status: 400 },
    );

    // clean up expired cookie
    errorResponse.cookies.set("sso_temp_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/login/sso",
    });
    return errorResponse;
  }

  const response = NextResponse.json({ token });
  response.cookies.set("sso_temp_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/login/sso",
  });

  return response;
}
