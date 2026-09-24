import { saml } from "@/lib/saml";
import {
  createLogoutContextToken,
  extractLogoutProfile,
} from "@/lib/saml-logout";
import {
  classifySamlValidationError,
  extractNip,
  getRelayStateCookieOptions,
  getSamlLogoutContextCookieOptions,
  getSsoBaseUrl,
  getTempTokenCookieOptions,
  relayStateMatches,
  SAML_LOGOUT_CONTEXT_COOKIE,
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

    const logoutProfile = extractLogoutProfile(profile);
    const nip = extractNip(profile);

    if (!nip) {
      return redirectWithError(request, "MissingNIP");
    }

    const logoutContextToken = createLogoutContextToken({
      nip,
      profile: logoutProfile,
    });

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

    response.cookies.set(
      SAML_LOGOUT_CONTEXT_COOKIE,
      logoutContextToken,
      getSamlLogoutContextCookieOptions(),
    );

    response.cookies.set(SSO_RELAY_STATE_COOKIE, "", {
      ...getRelayStateCookieOptions(),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    const errorCode = classifySamlValidationError(error);
    console.error("[SSO CALLBACK] SAML validation failed", { errorCode });

    return redirectWithError(request, errorCode);
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

  response.cookies.set(SAML_LOGOUT_CONTEXT_COOKIE, "", {
    ...getSamlLogoutContextCookieOptions(0),
    maxAge: 0,
  });

  return response;
}
