import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";
import type { SamlLogoutContext } from "@/lib/saml-logout";

let sessionValue: {
  user: {
    id: string;
    authProvider: string;
  };
} | null = {
  user: {
    id: "user-1",
    authProvider: "SSO",
  },
};

let currentUserValue: {
  authProvider: string;
  employee: { nip: string } | null;
} | null = {
  authProvider: "SSO",
  employee: { nip: "NIP-001" },
};

const authMock = mock.fn(async () => sessionValue);

const prismaUserFindUniqueMock = mock.fn(async () => currentUserValue);

const getLogoutUrlMock = mock.fn(
  async (
    profile: {
      issuer: string;
      nameID: string;
      nameIDFormat: string;
      sessionIndex?: string;
    },
    relayState: string,
  ) =>
    `https://idp.example.test/SingleLogoutService.php?SAMLRequest=encoded-request&RelayState=${encodeURIComponent(
      relayState,
    )}`,
);

const isConfiguredSsoOriginMock = mock.fn(
  (request: Request) =>
    request.headers.get("origin") === "https://app.example.test",
);

const verifyLogoutContextTokenMock = mock.fn(
  (): SamlLogoutContext => ({
    purpose: "saml-logout-context" as const,
    nip: "NIP-001",
    issuer: "https://idp.example.test/metadata",
    nameID: "persistent-name-id-001",
    nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
    sessionIndex: "session-001",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
);

const createRelayStateMock = mock.fn(() => "logout-relay-state-001");

mock.module("@/auth", {
  namedExports: {
    auth: authMock,
  },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: {
        findUnique: prismaUserFindUniqueMock,
      },
    },
  },
});

mock.module("@/lib/saml", {
  namedExports: {
    saml: {
      getLogoutUrlAsync: getLogoutUrlMock,
    },
  },
});

mock.module("@/lib/saml-logout", {
  namedExports: {
    verifyLogoutContextToken: verifyLogoutContextTokenMock,
  },
});

mock.module("@/lib/saml-transport", {
  namedExports: {
    createRelayState: createRelayStateMock,
    getSamlLogoutRelayStateCookieOptions: mock.fn(() => ({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300,
      path: "/api/auth/sso",
    })),
    isConfiguredSsoOrigin: isConfiguredSsoOriginMock,
    SAML_LOGOUT_CONTEXT_COOKIE: "sso_logout_context",
    SAML_LOGOUT_RELAY_STATE_COOKIE: "sso_logout_relay_state",
  },
});

let POST: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  sessionValue = {
    user: {
      id: "user-1",
      authProvider: "SSO",
    },
  };

  currentUserValue = {
    authProvider: "SSO",
    employee: { nip: "NIP-001" },
  };

  authMock.mock.resetCalls();
  prismaUserFindUniqueMock.mock.resetCalls();
  getLogoutUrlMock.mock.resetCalls();
  createRelayStateMock.mock.resetCalls();
  verifyLogoutContextTokenMock.mock.resetCalls();

  isConfiguredSsoOriginMock.mock.mockImplementation(
    (request: Request) =>
      request.headers.get("origin") === "https://app.example.test",
  );

  verifyLogoutContextTokenMock.mock.mockImplementation(() => ({
    purpose: "saml-logout-context",
    nip: "NIP-001",
    issuer: "https://idp.example.test/metadata",
    nameID: "persistent-name-id-001",
    nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
    sessionIndex: "session-001",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
});

function makeRequest(
  options: {
    origin?: string;
    logoutContext?: string;
  } = {},
): NextRequest {
  const headers = new Headers();

  if (options.origin !== undefined) {
    headers.set("origin", options.origin);
  }

  if (options.logoutContext !== undefined) {
    headers.set("cookie", `sso_logout_context=${options.logoutContext}`);
  }

  return new NextRequest("https://app.example.test/api/auth/sso/logout/start", {
    method: "POST",
    headers,
  });
}

describe("POST /api/auth/sso/logout/start", () => {
  it("returns an IdP LogoutRequest URL", async () => {
    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(
      body.redirectUrl,
      "https://idp.example.test/SingleLogoutService.php?SAMLRequest=encoded-request&RelayState=logout-relay-state-001",
    );

    assert.equal(prismaUserFindUniqueMock.mock.callCount(), 1);
    assert.equal(verifyLogoutContextTokenMock.mock.callCount(), 1);
    assert.equal(createRelayStateMock.mock.callCount(), 1);
    assert.equal(getLogoutUrlMock.mock.callCount(), 1);

    const [profile, relayState] = getLogoutUrlMock.mock.calls[0].arguments;

    assert.deepEqual(profile, {
      issuer: "https://idp.example.test/metadata",
      nameID: "persistent-name-id-001",
      nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      sessionIndex: "session-001",
    });

    assert.equal(relayState, "logout-relay-state-001");

    const setCookie = response.headers.get("set-cookie") ?? "";

    assert.match(setCookie, /sso_logout_relay_state=/);
    assert.doesNotMatch(setCookie, /persistent-name-id-001/);
    assert.doesNotMatch(setCookie, /NIP-001/);
  });

  it("supports a context without SessionIndex", async () => {
    verifyLogoutContextTokenMock.mock.mockImplementationOnce(() => ({
      purpose: "saml-logout-context",
      nip: "NIP-001",
      issuer: "https://idp.example.test/metadata",
      nameID: "persistent-name-id-001",
      nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }));

    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 200);

    const [profile] = getLogoutUrlMock.mock.calls[0].arguments;

    assert.deepEqual(profile, {
      issuer: "https://idp.example.test/metadata",
      nameID: "persistent-name-id-001",
      nameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
    });
  });

  it("rejects unauthenticated sessions", async () => {
    sessionValue = null;

    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 401);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("rejects LOCAL sessions", async () => {
    sessionValue = {
      user: {
        id: "local-user",
        authProvider: "LOCAL",
      },
    };

    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("rejects missing Origin", async () => {
    const response = await POST(
      makeRequest({
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("rejects foreign Origin", async () => {
    const response = await POST(
      makeRequest({
        origin: "https://attacker.example.test",
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("rejects missing context cookie", async () => {
    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
      }),
    );

    assert.equal(response.status, 409);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("rejects invalid context", async () => {
    verifyLogoutContextTokenMock.mock.mockImplementationOnce(() => {
      throw new Error("invalid context");
    });

    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        logoutContext: "tampered-context",
      }),
    );

    assert.equal(response.status, 409);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("binds context NIP through the database", async () => {
    currentUserValue = {
      authProvider: "SSO",
      employee: { nip: "DIFFERENT-NIP" },
    };

    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("rejects an SSO user without Employee", async () => {
    currentUserValue = {
      authProvider: "SSO",
      employee: null,
    };

    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 403);
    assert.equal(getLogoutUrlMock.mock.callCount(), 0);
  });

  it("returns a safe error when SAML generation fails", async () => {
    getLogoutUrlMock.mock.mockImplementationOnce(async () => {
      throw new Error("raw SAML payload must not leak");
    });

    const response = await POST(
      makeRequest({
        origin: "https://app.example.test",
        logoutContext: "signed-context",
      }),
    );

    assert.equal(response.status, 500);

    const body = await response.text();

    assert.doesNotMatch(body, /raw SAML payload/);
  });

  it("does not accept a caller-provided return URL", async () => {
    const request = makeRequest({
      origin: "https://app.example.test",
      logoutContext: "signed-context",
    });

    const response = await POST(
      new NextRequest(
        `${request.url}?returnUrl=https://attacker.example.test`,
        {
          method: "POST",
          headers: request.headers,
        },
      ),
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.doesNotMatch(body.redirectUrl, /attacker\.example\.test/);
  });
});
