import {
  checkRateLimit,
  getTrustedClientIdentity,
} from "./api/rate-limit";

const LOCAL_LOGIN_RATE_LIMIT = 10;
const LOCAL_LOGIN_WINDOW_MS = 60_000;
const MAX_LOCAL_IDENTITY_LENGTH = 128;

export function normalizeLocalCredentialIdentity(
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_LOCAL_IDENTITY_LENGTH
  ) {
    return null;
  }

  return normalized;
}

export function isLocalCredentialRateLimited(
  request: Request,
  username: unknown,
): boolean {
  const trustedClientIdentity = getTrustedClientIdentity(request);

  if (
    trustedClientIdentity &&
    !checkRateLimit(request, {
      clientIdentity: trustedClientIdentity,
      keyPrefix: "local-login-source",
      max: LOCAL_LOGIN_RATE_LIMIT,
      windowMs: LOCAL_LOGIN_WINDOW_MS,
    }).success
  ) {
    return true;
  }

  const identity = normalizeLocalCredentialIdentity(username);

  if (!identity) return false;

  return !checkRateLimit(request, {
    clientIdentity: identity,
    keyPrefix: "local-login-account",
    max: LOCAL_LOGIN_RATE_LIMIT,
    windowMs: LOCAL_LOGIN_WINDOW_MS,
  }).success;
}
