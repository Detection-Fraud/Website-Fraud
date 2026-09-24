import { auth } from "@/auth";
import { evaluateAuthPolicy } from "@/lib/auth-policy";
import { prisma } from "@/lib/prisma";
import {
  getSamlLogoutContextCookieOptions,
  getSsoBaseUrl,
  SAML_LOGOUT_CONTEXT_COOKIE,
} from "@/lib/saml-transport";
import { renewLogoutContextToken } from "@/lib/saml-logout";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const noStoreHeaders = { "Cache-Control": "no-store" };

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders },
  );
}

export async function POST(request: NextRequest) {
  let session;

  try {
    session = await auth();
  } catch {
    return jsonError("Gagal memeriksa sesi", 500);
  }

  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  if (session.user.authProvider !== "SSO") {
    return jsonError(
      "Refresh konteks SSO tidak tersedia untuk akun lokal",
      403,
    );
  }

  let expectedOrigin: string;

  try {
    expectedOrigin = getSsoBaseUrl();
  } catch {
    return jsonError("Konfigurasi SSO tidak valid", 500);
  }

  if (request.headers.get("origin") !== expectedOrigin) {
    return jsonError("Permintaan tidak valid", 403);
  }

  let currentUser;

  try {
    currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        authProvider: true,
        isActive: true,
        unitId: true,
        employee: {
          select: {
            nip: true,
            jenjang: true,
            kodeStatpeg: true,
            statKepeg: true,
            isPresentInSource: true,
            unitId: true,
          },
        },
      },
    });
  } catch {
    return jsonError("Gagal memeriksa identitas SSO", 500);
  }

  if (!currentUser) {
    return jsonError("Akun SSO tidak tersedia", 403);
  }

  const policy = evaluateAuthPolicy({
    provider: "SSO",
    user: {
      role: currentUser.role,
      authProvider: currentUser.authProvider,
      isActive: currentUser.isActive,
      unitId: currentUser.unitId,
    },
    employee: currentUser.employee,
  });

  if (!policy.allowed || !currentUser.employee?.nip?.trim()) {
    return jsonError("Akun SSO tidak lagi memenuhi syarat", 403);
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    return jsonError("Konfigurasi sesi tidak tersedia", 500);
  }

  let authJwt;

  try {
    authJwt = await getToken({
      req: request,
      secret,
      secureCookie: process.env.NODE_ENV === "production",
    });
  } catch {
    return jsonError("Sesi SSO tidak valid", 401);
  }

  if (
    !authJwt ||
    typeof authJwt.id !== "string" ||
    authJwt.id !== session.user.id ||
    authJwt.authProvider !== session.user.authProvider ||
    !Number.isInteger(authJwt.exp)
  ) {
    return jsonError("Sesi SSO tidak valid", 401);
  }

  const now = Math.floor(Date.now() / 1000);

  if ((authJwt.exp as number) <= now + 60) {
    return jsonError("Sesi SSO hampir berakhir", 401);
  }

  const contextToken = request.cookies.get(SAML_LOGOUT_CONTEXT_COOKIE)?.value;

  if (!contextToken) {
    return jsonError("Konteks logout tidak tersedia", 409);
  }

  let renewedContext;

  try {
    renewedContext = renewLogoutContextToken({
      token: contextToken,
      expectedNip: currentUser.employee.nip.trim(),
      authJwtExp: authJwt.exp as number,
      nowEpochSeconds: now,
    });
  } catch {
    return jsonError("Konteks logout tidak valid", 409);
  }

  if (!renewedContext) {
    return jsonError("Konteks logout tidak dapat diperbarui", 409);
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: noStoreHeaders,
  });

  response.cookies.set(
    SAML_LOGOUT_CONTEXT_COOKIE,
    renewedContext.token,
    getSamlLogoutContextCookieOptions(renewedContext.exp - now),
  );

  return response;
}
