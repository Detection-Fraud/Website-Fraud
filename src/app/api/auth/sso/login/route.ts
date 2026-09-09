import { saml } from "@/lib/saml";
import {
  checkRateLimit,
  getTrustedClientIdentity,
  rateLimitResponse,
} from "@/lib/api/rate-limit";
import {
  createRelayState,
  getRelayStateCookieOptions,
  isConfiguredSsoOrigin,
  SSO_RELAY_STATE_COOKIE,
} from "@/lib/saml-transport";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!isConfiguredSsoOrigin(request)) {
    return NextResponse.json(
      { error: "Permintaan tidak valid" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const clientIdentity = getTrustedClientIdentity(request);
  if (!clientIdentity) {
    return NextResponse.json(
      { error: "Trusted ingress identity is required" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rateLimit = checkRateLimit(request, {
    clientIdentity,
    keyPrefix: "sso-login",
    max: 10,
  });

  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  try {
    const relayState = createRelayState();

    const authUrl = await saml.getAuthorizeUrlAsync(relayState, "", {});

    const response = NextResponse.redirect(authUrl);

    response.cookies.set(
      SSO_RELAY_STATE_COOKIE,
      relayState,
      getRelayStateCookieOptions(),
    );

    return response;
  } catch {
    console.error("[SSO] Failed to generate SAML authorization request");

    return NextResponse.json(
      { error: "Gagal terhubung ke SSO Bulog" },
      { status: 500 },
    );
  }
}
