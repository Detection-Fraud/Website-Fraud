import crypto from "crypto";
import { saml } from "@/lib/saml";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const state = crypto.randomBytes(32).toString("hex");

    const authUrl = await saml.getAuthorizeUrlAsync(
      state, // RelayState — CSRF nonce
      "", // host — biarkan kosong, issuer sudah dikonfigurasi di saml.ts
      {},
    );

    const response = NextResponse.redirect(authUrl);

    response.cookies.set("sso_csrf_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 300,
      path: "/",
    });

    return response;
  } catch (error) {
    const err = error as Error;
    console.error(
      "[SSO] Gagal generate SAML AuthRequest URL:",
      err.message,
      err.stack,
    );
    return NextResponse.json(
      { error: "Gagal terhubung ke SSO Bulog", detail: err.message },
      { status: 500 },
    );
  }
}
