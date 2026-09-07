import { saml } from "@/lib/saml";
import {
  createRelayState,
  getRelayStateCookieOptions,
  SSO_RELAY_STATE_COOKIE,
} from "@/lib/saml-transport";
import { NextResponse } from "next/server";

export async function GET() {
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
