import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";
import type { SamlLogoutContext } from "@/lib/saml-logout";

const ORIGIN = "https://app.example.test";
const TOKEN = "signed-rejected-context";
const NAME_ID = "persistent-name-id";

const getLogoutUrlMock = mock.fn(
  async (_profile: unknown, relay: string) =>
    `https://idp.example.test/slo?SAMLRequest=request&RelayState=${encodeURIComponent(relay)}`,
);
const verifyContextMock = mock.fn((): SamlLogoutContext => ({
  purpose: "saml-logout-context",
  nip: "NIP-001",
  issuer: "https://idp.example.test/metadata",
  nameID: NAME_ID,
  nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  sessionIndex: "session-001",
  exp: Math.floor(Date.now() / 1000) + 3600,
}));
const claimTokenMock = mock.fn(
  (
    _token: string,
    _expiresAt: number,
  ): "claimed" | "replay" | "full" => {
    void _token;
    void _expiresAt;
    return "claimed" as const;
  },
);
const createRelayStateMock = mock.fn(() => "R".repeat(43));

function getRawCookieValues(request: Request, name: string): string[] {
  return (request.headers.get("cookie") ?? "")
    .split(/; */)
    .filter(
      (pair) =>
        pair.slice(
          0,
          pair.indexOf("=") < 0 ? pair.length : pair.indexOf("="),
        ) === name,
    )
    .map((pair) => {
      const separator = pair.indexOf("=");
      try {
        return decodeURIComponent(
          separator < 0 ? "" : pair.slice(separator + 1),
        );
      } catch {
        return "";
      }
    });
}

mock.module("@/lib/saml", {
  namedExports: { saml: { getLogoutUrlAsync: getLogoutUrlMock } },
});
mock.module("@/lib/saml-logout", {
  namedExports: {
    verifyLogoutContextToken: verifyContextMock,
    claimRejectedLogoutContextToken: claimTokenMock,
  },
});
mock.module("@/lib/saml-transport", {
  namedExports: {
    createRelayState: createRelayStateMock,
    getSamlLogoutRelayStateCookieOptions: mock.fn(() => ({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 300,
      path: "/api/auth/sso",
    })),
    getSamlLogoutContextCookieOptions: mock.fn((maxAge = 24 * 60 * 60) => ({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge,
      path: "/api/auth/sso",
    })),
    getSsoBaseUrl: mock.fn(() => ORIGIN),
    getRawCookieValues,
    SAML_LOGOUT_CONTEXT_COOKIE: "sso_logout_context",
    SAML_LOGOUT_RELAY_STATE_COOKIE: "sso_logout_relay_state",
    SAML_REJECTED_LOGOUT_RELAY_PREFIX: "rejected.",
  },
});

let POST: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  verifyContextMock.mock.resetCalls();
  claimTokenMock.mock.resetCalls();
  createRelayStateMock.mock.resetCalls();
  getLogoutUrlMock.mock.resetCalls();
  verifyContextMock.mock.mockImplementation(() => ({
    purpose: "saml-logout-context",
    nip: "NIP-001",
    issuer: "https://idp.example.test/metadata",
    nameID: NAME_ID,
    nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
    sessionIndex: "session-001",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  claimTokenMock.mock.mockImplementation(() => "claimed");
});

function request(
  options: {
    origin?: string;
    referer?: string;
    cookies?: string;
    body?: string;
  } = {},
): NextRequest {
  const headers = new Headers();
  if (options.origin !== undefined) headers.set("origin", options.origin);
  if (options.referer !== undefined) headers.set("referer", options.referer);
  if (options.cookies !== undefined) headers.set("cookie", options.cookies);
  return new NextRequest(`${ORIGIN}/api/auth/sso/logout/rejected/start`, {
    method: "POST",
    headers,
    ...(options.body === undefined ? {} : { body: options.body }),
  });
}

describe("POST /api/auth/sso/logout/rejected/start", () => {
  it("builds a new request from the signed profile without app session or request data", async () => {
    const response = await POST(
      request({
        origin: ORIGIN,
        cookies: `sso_logout_context=${TOKEN}`,
        body: '{"nameID":"attacker","returnUrl":"https://attacker.test"}',
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(
      body.redirectUrl,
      `https://idp.example.test/slo?SAMLRequest=request&RelayState=rejected.${"R".repeat(43)}`,
    );
    assert.deepEqual(getLogoutUrlMock.mock.calls[0].arguments, [
      {
        issuer: "https://idp.example.test/metadata",
        nameID: NAME_ID,
        nameIDFormat:
          "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
        sessionIndex: "session-001",
      },
      `rejected.${"R".repeat(43)}`,
      {},
    ]);
    assert.equal(claimTokenMock.mock.callCount(), 1);
    assert.equal(claimTokenMock.mock.calls[0].arguments[0], TOKEN);
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /sso_logout_relay_state=/,
    );
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /sso_logout_context=/,
    );
    const serialized = `${body.redirectUrl}${response.headers.get("set-cookie")}`;
    assert.doesNotMatch(serialized, /persistent-name-id|NIP-001|attacker/);
  });

  it("requires the exact Origin header and does not accept Referer as a substitute", async () => {
    for (const headers of [
      {},
      { origin: "https://attacker.example.test" },
      { referer: ORIGIN },
    ]) {
      const response = await POST(
        request({
          ...headers,
          cookies: `sso_logout_context=${TOKEN}`,
        }),
      );
      assert.equal(response.status, 403);
      assert.doesNotMatch(
        response.headers.get("set-cookie") ?? "",
        /sso_logout_context=/,
      );
    }
    assert.equal(verifyContextMock.mock.callCount(), 0);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("requires exactly one non-empty raw context cookie", async () => {
    for (const cookies of [
      undefined,
      `sso_logout_context=${TOKEN}; sso_logout_context=${TOKEN}`,
      "sso_logout_context=",
      "sso_logout_context=%GG",
    ]) {
      const response = await POST(request({ origin: ORIGIN, cookies }));
      assert.equal(response.status, 409);
      assert.match(
        response.headers.get("set-cookie") ?? "",
        /sso_logout_context=/,
      );
    }
    assert.equal(verifyContextMock.mock.callCount(), 0);
  });

  it("rejects invalid context, replay, and a full bounded replay store", async () => {
    verifyContextMock.mock.mockImplementationOnce(() => {
      throw new Error("raw profile must not leak");
    });
    const invalid = await POST(
      request({ origin: ORIGIN, cookies: `sso_logout_context=${TOKEN}` }),
    );
    assert.equal(invalid.status, 409);
    assert.match(
      invalid.headers.get("set-cookie") ?? "",
      /sso_logout_context=/,
    );

    claimTokenMock.mock.mockImplementationOnce(() => "replay");
    const replay = await POST(
      request({ origin: ORIGIN, cookies: `sso_logout_context=${TOKEN}` }),
    );
    assert.equal(replay.status, 409);
    assert.match(
      replay.headers.get("set-cookie") ?? "",
      /sso_logout_context=/,
    );
    claimTokenMock.mock.mockImplementationOnce(() => "full");
    const full = await POST(
      request({ origin: ORIGIN, cookies: `sso_logout_context=${TOKEN}` }),
    );
    assert.equal(full.status, 503);
    assert.match(
      full.headers.get("set-cookie") ?? "",
      /sso_logout_context=/,
    );
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("returns a generic error when LogoutRequest generation fails", async () => {
    getLogoutUrlMock.mock.mockImplementationOnce(async () => {
      throw new Error("secret SAML payload");
    });
    const response = await POST(
      request({ origin: ORIGIN, cookies: `sso_logout_context=${TOKEN}` }),
    );
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /secret SAML payload/);
    assert.equal(claimTokenMock.mock.callCount(), 1);
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /sso_logout_context=/,
    );
  });
});
