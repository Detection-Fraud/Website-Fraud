import crypto from "crypto";
import { saml } from "@/lib/saml";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const state = crypto.randomBytes(32).toString("hex");

    const authUrl = await saml.getAuthorizeUrlAsync(
      state,
      "fraud-detection-app",
      {},
    );

    const response = NextResponse.redirect(authUrl);

    response.cookies.set("sso_csrf_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[SSO] Gagal generate SAML AuthRequest URL: ", error);
    return NextResponse.json(
      { error: "Gagal terhubung ke SSO Bulog" },
      { status: 500 },
    );
  }
}
