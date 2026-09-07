import { consumeToken, registerCredential } from "@/lib/sso-token-store";
import {
  getSsoBaseUrl,
  getTempTokenCookieOptions,
  SSO_TEMP_TOKEN_COOKIE,
} from "@/lib/saml-transport";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function clearTemporaryTokenCookie(response: NextResponse): void {
  response.cookies.set(SSO_TEMP_TOKEN_COOKIE, "", {
    ...getTempTokenCookieOptions(0),
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  const expectedOrigin = getSsoBaseUrl(request);
  const receivedOrigin = request.headers.get("origin");

  if (!receivedOrigin || receivedOrigin !== expectedOrigin) {
    console.warn("[SSO TOKEN] Exchange origin rejected");

    return NextResponse.json(
      { error: "Permintaan tidak valid" },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const sourceToken = request.cookies.get(SSO_TEMP_TOKEN_COOKIE)?.value;

  if (!sourceToken) {
    return NextResponse.json(
      { error: "Token tidak ditemukan atau sudah expired" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  let nip: string;

  try {
    const decoded = jwt.verify(sourceToken, process.env.SSO_JWT_SECRET!);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      decoded.purpose !== "sso-callback" ||
      typeof decoded.nip !== "string"
    ) {
      throw new Error("Invalid source token");
    }

    nip = decoded.nip.trim();

    if (!nip) {
      throw new Error("Missing NIP");
    }
  } catch {
    console.warn("[SSO TOKEN] Source token rejected");

    const response = NextResponse.json(
      { error: "Token tidak valid atau sudah expired" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );

    clearTemporaryTokenCookie(response);
    return response;
  }

  if (!consumeToken(sourceToken)) {
    console.warn("[SSO TOKEN] Source token replay rejected");

    const response = NextResponse.json(
      { error: "Token sudah pernah digunakan", code: "TOKEN_REPLAYED" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      },
    );

    clearTemporaryTokenCookie(response);
    return response;
  }

  const bridgeCredential = jwt.sign(
    {
      nip,
      purpose: "sso-login",
      jti: randomUUID(),
    },
    process.env.SSO_JWT_SECRET!,
    {
      expiresIn: "60s",
    },
  );

  if (!registerCredential(bridgeCredential)) {
    console.warn("[SSO TOKEN] Bridge credential registration failed");

    const response = NextResponse.json(
      { error: "SSO sedang sibuk. Silakan coba lagi" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );

    clearTemporaryTokenCookie(response);
    return response;
  }

  const response = NextResponse.json(
    { token: bridgeCredential },
    { headers: { "Cache-Control": "no-store" } },
  );

  clearTemporaryTokenCookie(response);
  return response;
}
