import { saml } from "@/lib/saml";
import {
  extractNip,
  getRelayStateCookieOptions,
  getSsoBaseUrl,
  getTempTokenCookieOptions,
  relayStateMatches,
  SSO_RELAY_STATE_COOKIE,
  SSO_TEMP_TOKEN_COOKIE,
} from "@/lib/saml-transport";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const relayStateValue = formData.get("RelayState");
    const samlResponseValue = formData.get("SAMLResponse");
    const storedState = request.cookies.get(SSO_RELAY_STATE_COOKIE)?.value;

    const relayState =
      typeof relayStateValue === "string" ? relayStateValue : null;
    const samlResponse =
      typeof samlResponseValue === "string" ? samlResponseValue : null;

    if (
      !relayState ||
      !storedState ||
      !relayStateMatches(relayState, storedState)
    ) {
      return redirectWithError(request, "CSRFValidationFailed");
    }

    if (!samlResponse) {
      return redirectWithError(request, "InvalidSAMLResponse");
    }

    const { profile } = await saml.validatePostResponseAsync({
      SAMLResponse: samlResponse,
    });

    if (!profile) {
      return redirectWithError(request, "InvalidSAMLResponse");
    }

    const nip = extractNip(profile);

    if (!nip) {
      return redirectWithError(request, "MissingNIP");
    }

    const temporaryToken = jwt.sign(
      {
        nip,
        purpose: "sso-callback",
        jti: randomUUID(),
      },
      process.env.SSO_JWT_SECRET!,
      {
        expiresIn: "1m",
      },
    );

    const response = NextResponse.redirect(
      new URL("/login/sso", getSsoBaseUrl(request)),
    );

    response.cookies.set(
      SSO_TEMP_TOKEN_COOKIE,
      temporaryToken,
      getTempTokenCookieOptions(60),
    );

    response.cookies.set(SSO_RELAY_STATE_COOKIE, "", {
      ...getRelayStateCookieOptions(),
      maxAge: 0,
    });

    return response;
  } catch {
    console.error("[SSO CALLBACK] SAML validation failed");

    return redirectWithError(request, "InvalidSAMLResponse");
  }
}

function redirectWithError(request: Request, errorCode: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/login?error=${errorCode}`, getSsoBaseUrl(request)),
  );

  response.cookies.set(SSO_RELAY_STATE_COOKIE, "", {
    ...getRelayStateCookieOptions(),
    maxAge: 0,
  });

  return response;
}
