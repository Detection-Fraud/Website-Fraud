import { saml } from "@/lib/saml";
import {
  claimRejectedLogoutContextToken,
  verifyLogoutContextToken,
} from "@/lib/saml-logout";
import {
  createRelayState,
  getRawCookieValues,
  getSamlLogoutContextCookieOptions,
  getSamlLogoutRelayStateCookieOptions,
  getSsoBaseUrl,
  SAML_LOGOUT_CONTEXT_COOKIE,
  SAML_LOGOUT_RELAY_STATE_COOKIE,
  SAML_REJECTED_LOGOUT_RELAY_PREFIX,
} from "@/lib/saml-transport";
import { NextRequest, NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

function contextError(message: string, status: number) {
  const response = errorResponse(message, status);
  response.cookies.set(
    SAML_LOGOUT_CONTEXT_COOKIE,
    "",
    getSamlLogoutContextCookieOptions(0),
  );
  return response;
}

export async function POST(request: NextRequest) {
  let baseUrl: string;
  try {
    baseUrl = getSsoBaseUrl();
  } catch {
    return errorResponse("Konfigurasi SSO tidak valid", 500);
  }

  if (request.headers.get("origin") !== baseUrl)
    return errorResponse("Permintaan tidak valid", 403);

  const contextCookies = getRawCookieValues(
    request,
    SAML_LOGOUT_CONTEXT_COOKIE,
  );
  if (contextCookies.length !== 1 || !contextCookies[0])
    return contextError("Konteks logout tidak tersedia", 409);

  let context;
  try {
    context = verifyLogoutContextToken(contextCookies[0]);
  } catch {
    return contextError("Konteks logout tidak valid", 409);
  }

  const claim = claimRejectedLogoutContextToken(
    contextCookies[0],
    context.exp,
  );
  if (claim === "replay")
    return contextError("Permintaan logout sudah digunakan", 409);
  if (claim === "full")
    return contextError("Logout sementara tidak tersedia", 503);

  try {
    const relayState = `${SAML_REJECTED_LOGOUT_RELAY_PREFIX}${createRelayState()}`;
    const redirectUrl = await saml.getLogoutUrlAsync(
      {
        issuer: context.issuer,
        nameID: context.nameID,
        nameIDFormat: context.nameIDFormat,
        ...(context.sessionIndex ? { sessionIndex: context.sessionIndex } : {}),
      },
      relayState,
      {},
    );

    const response = NextResponse.json(
      { redirectUrl },
      { status: 200, headers: NO_STORE },
    );
    response.cookies.set(
      SAML_LOGOUT_RELAY_STATE_COOKIE,
      relayState,
      getSamlLogoutRelayStateCookieOptions(),
    );
    response.cookies.set(
      SAML_LOGOUT_CONTEXT_COOKIE,
      "",
      getSamlLogoutContextCookieOptions(0),
    );
    return response;
  } catch {
    return contextError("Gagal menyiapkan logout SSO", 500);
  }
}
