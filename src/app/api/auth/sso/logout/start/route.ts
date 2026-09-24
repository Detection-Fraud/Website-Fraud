import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saml } from "@/lib/saml";
import {
  createRelayState,
  getSamlLogoutRelayStateCookieOptions,
  isConfiguredSsoOrigin,
  SAML_LOGOUT_CONTEXT_COOKIE,
  SAML_LOGOUT_RELAY_STATE_COOKIE,
} from "@/lib/saml-transport";
import { verifyLogoutContextToken } from "@/lib/saml-logout";
import { NextResponse, NextRequest } from "next/server";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: noStoreHeaders,
    },
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
    return jsonError("Logout SSO tidak tersedia untuk akun lokal", 403);
  }

  try {
    if (!isConfiguredSsoOrigin(request)) {
      return jsonError("Permintaan tidak valid", 403);
    }
  } catch {
    return jsonError("Konfigurasi SSO tidak valid", 500);
  }

  let currentUser;

  try {
    currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        authProvider: true,
        employee: {
          select: {
            nip: true,
          },
        },
      },
    });
  } catch {
    return jsonError("Gagal memeriksa identitas SSO", 500);
  }

  if (
    !currentUser ||
    currentUser.authProvider !== "SSO" ||
    !currentUser.employee?.nip?.trim()
  ) {
    return jsonError("Logout SSO tidak tersedia untuk akun ini", 403);
  }

  const logoutContextToken = request.cookies.get(
    SAML_LOGOUT_CONTEXT_COOKIE,
  )?.value;

  if (!logoutContextToken) {
    return jsonError("Konteks logout tidak tersedia", 409);
  }

  let logoutContext;

  try {
    logoutContext = verifyLogoutContextToken(logoutContextToken);
  } catch {
    return jsonError("Konteks logout tidak valid", 409);
  }

  if (logoutContext.nip !== currentUser.employee.nip.trim()) {
    return jsonError("Konteks logout tidak sesuai", 403);
  }

  try {
    const relayState = createRelayState();

    const logoutProfile = {
      issuer: logoutContext.issuer,
      nameID: logoutContext.nameID,
      nameIDFormat: logoutContext.nameIDFormat,
      ...(logoutContext.sessionIndex
        ? { sessionIndex: logoutContext.sessionIndex }
        : {}),
    };

    const redirectUrl = await saml.getLogoutUrlAsync(
      logoutProfile,
      relayState,
      {},
    );

    const response = NextResponse.json(
      { redirectUrl },
      {
        status: 200,
        headers: noStoreHeaders,
      },
    );

    response.cookies.set(
      SAML_LOGOUT_RELAY_STATE_COOKIE,
      relayState,
      getSamlLogoutRelayStateCookieOptions(),
    );

    return response;
  } catch {
    return jsonError("Gagal menyiapkan logout SSO", 500);
  }
}
