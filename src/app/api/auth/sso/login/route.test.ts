import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";

const getAuthorizeUrlMock = mock.fn(async (relayState: string) =>
  `https://idp.example.test/login?RelayState=${relayState}`,
);

mock.module("@/lib/saml", {
  namedExports: {
    saml: { getAuthorizeUrlAsync: getAuthorizeUrlMock },
  },
});

mock.module("@/lib/saml-transport", {
  namedExports: {
    createRelayState: mock.fn(() => "relay-state-test"),
    getRelayStateCookieOptions: mock.fn(() => ({ httpOnly: true })),
    isConfiguredSsoOrigin: mock.fn(() => true),
    SSO_RELAY_STATE_COOKIE: "sso-relay-state",
  },
});

let GET: (request: Request) => Promise<Response>;
const previousTrustedHeader = process.env.TRUSTED_INGRESS_IDENTITY_HEADER;

before(async () => {
  process.env.TRUSTED_INGRESS_IDENTITY_HEADER = "x-ingress-client-id";
  ({ GET } = await import("./route"));
});

after(() => {
  if (previousTrustedHeader === undefined) {
    delete process.env.TRUSTED_INGRESS_IDENTITY_HEADER;
  } else {
    process.env.TRUSTED_INGRESS_IDENTITY_HEADER = previousTrustedHeader;
  }
});

describe("GET /api/auth/sso/login", () => {
  it("uses a per-client limit instead of a process-global SSO limit", async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = await GET(
        new Request("http://localhost/api/auth/sso/login", {
          headers: { "x-ingress-client-id": "203.0.113.10" },
        }),
      );

      assert.equal(response.status, 307);
      assert.match(response.headers.get("location") ?? "", /idp\.example\.test/);
    }

    const otherClient = await GET(
      new Request("http://localhost/api/auth/sso/login", {
        headers: { "x-ingress-client-id": "198.51.100.99" },
      }),
    );

    assert.equal(otherClient.status, 307);
    assert.equal(getAuthorizeUrlMock.mock.callCount(), 11);
  });

  it("rejects requests without trusted ingress identity before limiting", async () => {
    const response = await GET(
      new Request("http://localhost/api/auth/sso/login"),
    );

    assert.equal(response.status, 503);
    assert.equal(getAuthorizeUrlMock.mock.callCount(), 11);
  });

  it("does not trust arbitrary forwarding headers", async () => {
    const response = await GET(
      new Request("http://localhost/api/auth/sso/login", {
        headers: {
          "x-forwarded-for": "203.0.113.10",
          "x-real-ip": "203.0.113.10",
        },
      }),
    );

    assert.equal(response.status, 503);
    assert.equal(getAuthorizeUrlMock.mock.callCount(), 11);
  });

  it("rejects forwarding headers even when selected as the configured header", async () => {
    process.env.TRUSTED_INGRESS_IDENTITY_HEADER = "x-forwarded-for";

    try {
      const response = await GET(
        new Request("http://localhost/api/auth/sso/login", {
          headers: { "x-forwarded-for": "203.0.113.10" },
        }),
      );

      assert.equal(response.status, 503);
      assert.equal(getAuthorizeUrlMock.mock.callCount(), 11);
    } finally {
      process.env.TRUSTED_INGRESS_IDENTITY_HEADER = "x-ingress-client-id";
    }
  });
});
