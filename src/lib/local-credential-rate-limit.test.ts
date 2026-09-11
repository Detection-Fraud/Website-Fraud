import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";

type RateLimitOptions = {
  clientIdentity?: string;
  keyPrefix?: string;
  max?: number;
  windowMs?: number;
};

type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

type CheckRateLimit = (
  request: Request,
  options: RateLimitOptions,
) => RateLimitResult;

const defaultRateLimitResult = () => ({
  success: true,
  remaining: 9,
  resetAt: Date.now() + 60_000,
});
const checkRateLimitMock = mock.fn<CheckRateLimit>(defaultRateLimitResult);
const trustedClientIdentityMock = mock.fn<() => string | null>(
  () => "trusted-client-1",
);

mock.module("./api/rate-limit", {
  namedExports: {
    checkRateLimit: checkRateLimitMock,
    getTrustedClientIdentity: trustedClientIdentityMock,
  },
});

let isLocalCredentialRateLimited: typeof import("./local-credential-rate-limit").isLocalCredentialRateLimited;
let normalizeLocalCredentialIdentity: typeof import("./local-credential-rate-limit").normalizeLocalCredentialIdentity;

before(async () => {
  const importedModule = await import("./local-credential-rate-limit");
  isLocalCredentialRateLimited = importedModule.isLocalCredentialRateLimited;
  normalizeLocalCredentialIdentity = importedModule.normalizeLocalCredentialIdentity;
});

function request() {
  return new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
  });
}

describe("LOCAL credential rate limiting", () => {
  beforeEach(() => {
    checkRateLimitMock.mock.resetCalls();
    checkRateLimitMock.mock.mockImplementation(defaultRateLimitResult);
    trustedClientIdentityMock.mock.resetCalls();
    trustedClientIdentityMock.mock.mockImplementation(() => "trusted-client-1");
  });

  it("normalizes the account key without changing the database lookup value", () => {
    assert.equal(normalizeLocalCredentialIdentity("  Admin.User  "), "admin.user");
    assert.equal(normalizeLocalCredentialIdentity("x".repeat(129)), null);
    assert.equal(normalizeLocalCredentialIdentity(null), null);
  });

  it("uses trusted source and normalized account limits", () => {
    assert.equal(isLocalCredentialRateLimited(request(), " Admin.User "), false);

    assert.deepEqual(
      checkRateLimitMock.mock.calls.map((call) => call.arguments[1]),
      [
        {
          clientIdentity: "trusted-client-1",
          keyPrefix: "local-login-source",
          max: 10,
          windowMs: 60_000,
        },
        {
          clientIdentity: "admin.user",
          keyPrefix: "local-login-account",
          max: 10,
          windowMs: 60_000,
        },
      ],
    );
  });

  it("skips the source bucket but applies the account bucket when ingress identity is unavailable", () => {
    trustedClientIdentityMock.mock.mockImplementationOnce(() => null);

    const req = new Request(
      "http://localhost/api/auth/callback/credentials",
      {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          "x-real-ip": "203.0.113.10",
        },
      },
    );

    assert.equal(isLocalCredentialRateLimited(req, "Admin.User"), false);
    assert.deepEqual(
      checkRateLimitMock.mock.calls.map((call) => call.arguments[1]),
      [
        {
          clientIdentity: "admin.user",
          keyPrefix: "local-login-account",
          max: 10,
          windowMs: 60_000,
        },
      ],
    );
  });

  it("skips the source bucket when the attested identity is empty", () => {
    trustedClientIdentityMock.mock.mockImplementationOnce(() => "");

    assert.equal(isLocalCredentialRateLimited(request(), "Admin.User"), false);
    assert.deepEqual(
      checkRateLimitMock.mock.calls.map((call) => call.arguments[1]),
      [
        {
          clientIdentity: "admin.user",
          keyPrefix: "local-login-account",
          max: 10,
          windowMs: 60_000,
        },
      ],
    );
  });

  it("returns limited when the trusted source or account bucket rejects", () => {
    checkRateLimitMock.mock.mockImplementationOnce(() => ({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    }));

    assert.equal(isLocalCredentialRateLimited(request(), "Admin.User"), true);
    assert.equal(checkRateLimitMock.mock.callCount(), 1);
  });

  it("returns a generic rejection for invalid credentials without account enumeration", () => {
    const invalidUsername = isLocalCredentialRateLimited(request(), "");

    trustedClientIdentityMock.mock.mockImplementationOnce(() => null);
    const invalidAccount = isLocalCredentialRateLimited(request(), "unknown");

    assert.equal(invalidUsername, false);
    assert.equal(invalidAccount, false);
  });
});
