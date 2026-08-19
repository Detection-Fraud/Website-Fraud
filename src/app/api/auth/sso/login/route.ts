import { saml } from "@/lib/saml";
import crypto from "crypto";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const nonce = crypto.randomBytes(16).toString("hex");
    const timestamp = Date.now().toString();
    const payload = `${timestamp}:${nonce}`;
    const signature = crypto
      .createHmac("sha256", process.env.SSO_JWT_SECRET!)
      .update(payload)
      .digest("hex");
    const state = `${payload}:${signature}`;

    const authUrl = await saml.getAuthorizeUrlAsync(
      state, // RelayState — CSRF nonce
      "", // host — biarkan kosong, issuer sudah dikonfigurasi di saml.ts
      {},
    );

    return NextResponse.redirect(authUrl);
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
