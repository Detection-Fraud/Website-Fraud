import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

type SessionValue = {
  user: { id: string; authProvider: string };
} | null;

type UserValue = {
  role: string;
  authProvider: string;
  isActive: boolean;
  unitId: string | null;
  employee: {
    nip: string;
    jenjang: string;
    kodeStatpeg: string;
    statKepeg: string;
    isPresentInSource: boolean;
    unitId: string | null;
  } | null;
} | null;

type JwtValue = {
  id?: unknown;
  authProvider?: unknown;
  exp?: unknown;
} | null;

let sessionValue: SessionValue;
let userValue: UserValue;
let jwtValue: JwtValue;
let renewedValue: { token: string; exp: number } | null;
let configuredOrigin = "https://app.example.test";

const authMock = mock.fn(async () => sessionValue);
const findUniqueMock = mock.fn(async () => userValue);
const evaluateAuthPolicyMock = mock.fn(
  (_input: {
    provider: string;
    user: {
      role: string;
      authProvider: string;
      isActive: boolean;
      unitId: string | null;
    };
    employee: {
      nip: string;
      jenjang: string;
      kodeStatpeg: string;
      statKepeg: string;
      isPresentInSource: boolean;
      unitId: string | null;
    } | null;
  }) => ({ allowed: true }),
);
const getSsoBaseUrlMock = mock.fn(() => configuredOrigin);
const getTokenMock = mock.fn(
  async (_options: { req: Request; secret: string; secureCookie: boolean }) =>
    jwtValue,
);
const renewLogoutContextTokenMock = mock.fn(
  (_input: {
    token: string;
    expectedNip: string;
    authJwtExp: number;
    nowEpochSeconds: number;
  }) => renewedValue,
);
const cookieOptionsMock = mock.fn((maxAge: number) => ({
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/api/auth/sso",
  maxAge,
}));

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/auth-policy", {
  namedExports: { evaluateAuthPolicy: evaluateAuthPolicyMock },
});
mock.module("@/lib/prisma", {
  namedExports: { prisma: { user: { findUnique: findUniqueMock } } },
});
mock.module("@/lib/saml-transport", {
  namedExports: {
    getSamlLogoutContextCookieOptions: cookieOptionsMock,
    getSsoBaseUrl: getSsoBaseUrlMock,
    SAML_LOGOUT_CONTEXT_COOKIE: "sso_logout_context",
  },
});
mock.module("@/lib/saml-logout", {
  namedExports: { renewLogoutContextToken: renewLogoutContextTokenMock },
});
mock.module("next-auth/jwt", {
  namedExports: { getToken: getTokenMock },
});

let POST: (request: NextRequest) => Promise<Response>;
const oldAuthSecret = process.env.AUTH_SECRET;
const oldNextAuthSecret = process.env.NEXTAUTH_SECRET;
const oldNodeEnv = process.env.NODE_ENV;

before(async () => {
  process.env.AUTH_SECRET = "refresh-route-test-secret";
  delete process.env.NEXTAUTH_SECRET;
  Reflect.set(process.env, "NODE_ENV", "production");
  ({ POST } = await import("./route"));
});

after(() => {
  if (oldAuthSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = oldAuthSecret;
  if (oldNextAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = oldNextAuthSecret;
  if (oldNodeEnv === undefined) {
    Reflect.deleteProperty(process.env, "NODE_ENV");
  } else {
    Reflect.set(process.env, "NODE_ENV", oldNodeEnv);
  }
});

beforeEach(() => {
  sessionValue = { user: { id: "user-1", authProvider: "SSO" } };
  userValue = {
    role: "ADMIN",
    authProvider: "SSO",
    isActive: true,
    unitId: null,
    employee: {
      nip: "NIP-001",
      jenjang: "5",
      kodeStatpeg: "01",
      statKepeg: "02",
      isPresentInSource: true,
      unitId: null,
    },
  };
  jwtValue = {
    id: "user-1",
    authProvider: "SSO",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  renewedValue = {
    token: "renewed-signed-context",
    exp: Math.floor(Date.now() / 1000) + 1800,
  };
  configuredOrigin = "https://app.example.test";

  authMock.mock.resetCalls();
  findUniqueMock.mock.resetCalls();
  evaluateAuthPolicyMock.mock.resetCalls();
  getSsoBaseUrlMock.mock.resetCalls();
  getTokenMock.mock.resetCalls();
  renewLogoutContextTokenMock.mock.resetCalls();
  cookieOptionsMock.mock.resetCalls();
  evaluateAuthPolicyMock.mock.mockImplementation(() => ({ allowed: true }));
  getSsoBaseUrlMock.mock.mockImplementation(() => configuredOrigin);
  getTokenMock.mock.mockImplementation(async () => jwtValue);
  renewLogoutContextTokenMock.mock.mockImplementation(() => renewedValue);
});

function makeRequest(
  options: {
    origin?: string;
    referer?: string;
    context?: string;
  } = {},
): NextRequest {
  const headers = new Headers();
  if (options.origin !== undefined) headers.set("origin", options.origin);
  if (options.referer !== undefined) headers.set("referer", options.referer);
  if (options.context !== undefined) {
    headers.set("cookie", `sso_logout_context=${options.context}`);
  }
  return new NextRequest(
    "https://app.example.test/api/auth/sso/logout/context/refresh",
    { method: "POST", headers },
  );
}

async function assertNoRenewedCookie(response: Response) {
  assert.doesNotMatch(
    response.headers.get("set-cookie") ?? "",
    /sso_logout_context=/,
  );
}

describe("POST /api/auth/sso/logout/context/refresh", () => {
  it("renews a context cookie with bounded shared attributes and no-store", async () => {
    const now = Math.floor(Date.now() / 1000);
    renewedValue = { token: "renewed-signed-context", exp: now + 1200 };
    jwtValue = { id: "user-1", authProvider: "SSO", exp: now + 2400 };

    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        context: "signed-context",
      }),
    );

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /sso_logout_context=renewed-signed-context/,
    );
    assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
    assert.match(response.headers.get("set-cookie") ?? "", /Secure/i);
    assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Lax/i);
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /Path=\/api\/auth\/sso/i,
    );
    assert.equal(cookieOptionsMock.mock.calls[0].arguments[0], 1200);
    assert.deepEqual(getTokenMock.mock.calls[0].arguments[0], {
      req: getTokenMock.mock.calls[0].arguments[0].req,
      secret: "refresh-route-test-secret",
      secureCookie: true,
    });
    assert.equal(
      renewLogoutContextTokenMock.mock.calls[0].arguments[0].expectedNip,
      "NIP-001",
    );
    assert.equal(
      renewLogoutContextTokenMock.mock.calls[0].arguments[0].authJwtExp,
      now + 2400,
    );
  });

  it("rejects anonymous and LOCAL sessions", async () => {
    sessionValue = null;
    let response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );
    assert.equal(response.status, 401);
    await assertNoRenewedCookie(response);
    assert.equal(findUniqueMock.mock.callCount(), 0);

    sessionValue = { user: { id: "user-2", authProvider: "LOCAL" } };
    response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );
    assert.equal(response.status, 403);
    await assertNoRenewedCookie(response);
    assert.equal(findUniqueMock.mock.callCount(), 0);
  });

  it("requires exact Origin and never accepts Referer as a substitute", async () => {
    for (const request of [
      makeRequest({ context: "context" }),
      makeRequest({
        context: "context",
        referer: "https://app.example.test/page",
      }),
      makeRequest({
        origin: "https://foreign.example.test",
        context: "context",
      }),
    ]) {
      const response = await POST(request);
      assert.equal(response.status, 403);
      await assertNoRenewedCookie(response);
    }
    assert.equal(findUniqueMock.mock.callCount(), 0);
  });

  it("fails closed when the configured origin cannot be read", async () => {
    getSsoBaseUrlMock.mock.mockImplementationOnce(() => {
      throw new Error("bad config");
    });
    const response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );
    assert.equal(response.status, 500);
    await assertNoRenewedCookie(response);
    assert.equal(findUniqueMock.mock.callCount(), 0);
  });

  it("rechecks active account eligibility and requires a linked Employee", async () => {
    userValue = { ...userValue!, isActive: false };
    evaluateAuthPolicyMock.mock.mockImplementationOnce(() => ({
      allowed: false,
      reason: "inactive_user",
    }));
    let response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );
    assert.equal(response.status, 403);
    await assertNoRenewedCookie(response);

    userValue = { ...userValue!, isActive: true, employee: null };
    response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );
    assert.equal(response.status, 403);
    await assertNoRenewedCookie(response);
    assert.equal(renewLogoutContextTokenMock.mock.callCount(), 0);
  });

  it("rejects a currently ineligible SSO account using current database policy fields", async () => {
    userValue = {
      role: "PIC",
      authProvider: "SSO",
      isActive: true,
      unitId: "unit-1",
      employee: {
        nip: "NIP-001",
        jenjang: "3",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: true,
        unitId: "unit-1",
      },
    };
    evaluateAuthPolicyMock.mock.mockImplementationOnce(() => ({
      allowed: false,
      reason: "pic_ineligible",
    }));

    const response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );

    assert.equal(response.status, 403);
    await assertNoRenewedCookie(response);
    assert.equal(
      evaluateAuthPolicyMock.mock.calls[0].arguments[0].provider,
      "SSO",
    );
    assert.deepEqual(evaluateAuthPolicyMock.mock.calls[0].arguments[0].user, {
      role: "PIC",
      authProvider: "SSO",
      isActive: true,
      unitId: "unit-1",
    });
    assert.deepEqual(
      evaluateAuthPolicyMock.mock.calls[0].arguments[0].employee,
      {
        nip: "NIP-001",
        jenjang: "3",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: true,
        unitId: "unit-1",
      },
    );
    assert.equal(renewLogoutContextTokenMock.mock.callCount(), 0);
  });

  it("rejects JWT identity or provider mismatches and invalid expiry", async () => {
    const base = {
      id: "user-1",
      authProvider: "SSO",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    for (const invalid of [
      { ...base, id: "other-user" },
      { ...base, authProvider: "LOCAL" },
      { ...base, exp: Math.floor(Date.now() / 1000) + 30 },
      { ...base, exp: 1.5 },
    ]) {
      jwtValue = invalid;
      const response = await POST(
        makeRequest({ origin: "https://app.example.test", context: "context" }),
      );
      assert.equal(response.status, 401);
      await assertNoRenewedCookie(response);
    }
    assert.equal(renewLogoutContextTokenMock.mock.callCount(), 0);
  });

  it("uses the NEXTAUTH_SECRET fallback and production secure-cookie setting", async () => {
    delete process.env.AUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "nextauth-fallback-secret";
    const response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );
    assert.equal(response.status, 204);
    assert.equal(
      getTokenMock.mock.calls[0].arguments[0].secret,
      "nextauth-fallback-secret",
    );
    assert.equal(getTokenMock.mock.calls[0].arguments[0].secureCookie, true);
  });

  it("does not renew if the context is absent, invalid, expired, near expiry, or NIP-mismatched", async () => {
    let response = await POST(
      makeRequest({ origin: "https://app.example.test" }),
    );
    assert.equal(response.status, 409);
    await assertNoRenewedCookie(response);

    for (const invalidContext of [
      "invalid-signature",
      "expired-context",
      "near-expiry-context",
      "other-nip-context",
    ]) {
      renewLogoutContextTokenMock.mock.mockImplementationOnce(() => null);
      response = await POST(
        makeRequest({
          origin: "https://app.example.test",
          context: invalidContext,
        }),
      );
      assert.equal(response.status, 409);
      await assertNoRenewedCookie(response);
    }
    assert.equal(renewLogoutContextTokenMock.mock.callCount(), 4);
  });

  it("returns safe failures for missing secret and JWT decoding errors", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    let response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );
    assert.equal(response.status, 500);
    await assertNoRenewedCookie(response);

    process.env.AUTH_SECRET = "refresh-route-test-secret";
    getTokenMock.mock.mockImplementationOnce(async () => {
      throw new Error("private JWT detail");
    });
    response = await POST(
      makeRequest({ origin: "https://app.example.test", context: "context" }),
    );
    assert.equal(response.status, 401);
    assert.doesNotMatch(await response.text(), /private JWT detail/);
    await assertNoRenewedCookie(response);
  });
});
