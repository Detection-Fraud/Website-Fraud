import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";

type NextAuthFactory = (options: unknown) => {
  handlers: Record<string, never>;
  auth: ReturnType<typeof mock.fn>;
  signIn: ReturnType<typeof mock.fn>;
  signOut: ReturnType<typeof mock.fn>;
};

const nextAuthMock = mock.fn<NextAuthFactory>(() => ({
  handlers: {},
  auth: mock.fn(),
  signIn: mock.fn(),
  signOut: mock.fn(),
}));
const findUniqueMock = mock.fn<(...args: unknown[]) => Promise<unknown>>();
const localCredentialRateLimitMock = mock.fn(() => false);

mock.module("next-auth", {
  defaultExport: nextAuthMock,
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: { findUnique: findUniqueMock },
    },
  },
});
mock.module("@/lib/local-credential-rate-limit", {
  namedExports: {
    isLocalCredentialRateLimited: localCredentialRateLimitMock,
  },
});

type Authorize = (
  credentials: Record<string, unknown>,
  request: Request,
) => Promise<unknown>;

let localAuthorize: Authorize;
let ssoAuthorize: Authorize;

before(async () => {
  await import("./auth");
  const options = nextAuthMock.mock.calls[0]?.arguments[0] as {
    providers: Array<{
      id: string;
      authorize: Authorize;
      options?: { id?: string; authorize?: Authorize };
    }>;
  };

  const getConfiguredAuthorize = (provider: {
    authorize: Authorize;
    options?: { authorize?: Authorize };
  }) => provider.options?.authorize ?? provider.authorize;

  localAuthorize = getConfiguredAuthorize(
    options.providers.find((provider) => provider.id === "credentials")!,
  );
  ssoAuthorize = getConfiguredAuthorize(
    options.providers.find((provider) => provider.options?.id === "sso-login")!,
  );
});

beforeEach(() => {
  findUniqueMock.mock.resetCalls();
  localCredentialRateLimitMock.mock.resetCalls();
  localCredentialRateLimitMock.mock.mockImplementation(() => false);
});

function request() {
  return new Request("http://localhost/api/auth/callback/credentials", {
    method: "POST",
  });
}

function localUser() {
  return {
    id: "user-1",
    name: "Local Admin",
    username: "admin",
    role: "ADMIN",
    authProvider: "LOCAL",
    isActive: true,
    unitId: null,
    password: "$2b$10$J5hxdrXgJUhi3syFwGJUvOo80KkOu8aUWyl2olFaXtmVfnfGhVlna",
    passwordChangedAt: null,
    unit: null,
  };
}

describe("LOCAL credentials authorization boundary", { concurrency: false }, () => {
  it("allows a valid LOCAL login below the limiter threshold", async () => {
    findUniqueMock.mock.mockImplementationOnce(async () => localUser());

    const result = await localAuthorize(
      { username: "admin", password: "correct" },
      request(),
    );

    assert.equal((result as { role: string }).role, "ADMIN");
    assert.equal(localCredentialRateLimitMock.mock.callCount(), 1);
    assert.equal(findUniqueMock.mock.callCount(), 1);
  });

  it("rejects a limited LOCAL attempt before account lookup", async () => {
    localCredentialRateLimitMock.mock.mockImplementationOnce(() => true);

    const result = await localAuthorize(
      { username: "admin", password: "correct" },
      request(),
    );

    assert.equal(result, null);
    assert.equal(findUniqueMock.mock.callCount(), 0);
  });

  it("keeps invalid-account and invalid-password results generic", async () => {
    findUniqueMock.mock.mockImplementationOnce(async () => null);
    const unknownAccount = await localAuthorize(
      { username: "unknown", password: "wrong" },
      request(),
    );

    findUniqueMock.mock.mockImplementationOnce(async () => localUser());
    const wrongPassword = await localAuthorize(
      { username: "admin", password: "wrong" },
      request(),
    );

    assert.equal(unknownAccount, null);
    assert.equal(wrongPassword, null);
  });

  it("does not apply the LOCAL limiter to the SSO provider", async () => {
    const result = await ssoAuthorize({}, request());

    assert.equal(result, null);
    assert.equal(localCredentialRateLimitMock.mock.callCount(), 0);
  });
});
