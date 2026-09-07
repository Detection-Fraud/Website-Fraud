import crypto from "crypto";
import type { Profile } from "@node-saml/node-saml";

export const SSO_RELAY_STATE_COOKIE = "sso_csrf_state";
export const SSO_TEMP_TOKEN_COOKIE = "sso_temp_token";

const SSO_RELAY_STATE_MAX_AGE_SECONDS = 5 * 60;

export function createRelayState(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function relayStateMatches(
  receivedState: string,
  storedState: string,
): boolean {
  const received = Buffer.from(receivedState, "utf8");
  const stored = Buffer.from(storedState, "utf8");

  return (
    received.length === stored.length &&
    crypto.timingSafeEqual(received, stored)
  );
}

export function getRelayStateCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    maxAge: SSO_RELAY_STATE_MAX_AGE_SECONDS,
    path: "/",
  };
}

export function getTempTokenCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/api/auth/sso",
  };
}

export function getSsoBaseUrl(request?: Request): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    const parsed = new URL(configuredUrl);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("NEXT_PUBLIC_APP_URL must use HTTP or HTTPS");
    }

    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production");
    }

    return parsed.origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return "http://localhost:3000";
}

export function extractNip(profile: Profile): string | null {
  const candidates = [
    profile.nip,
    profile.uid,
    profile.employeeID,
    profile.nameID,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}
