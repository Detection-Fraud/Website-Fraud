import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";

const findUniqueMock = mock.fn<(...args: any[]) => Promise<unknown>>(
  async () => null,
);

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: { findUnique: findUniqueMock },
    },
  },
});

let authorized: NonNullable<
  NonNullable<typeof import("./auth.config").authConfig.callbacks>["authorized"]
>;

before(async () => {
  const { authConfig } = await import("./auth.config");
  authorized = authConfig.callbacks?.authorized as typeof authorized;
});

beforeEach(() => {
  findUniqueMock.mock.resetCalls();
});

function request(pathname: string) {
  return { nextUrl: new URL(`http://localhost${pathname}`) } as never;
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: "user-1",
      role: "ADMIN",
      authProvider: "SSO",
      passwordChangedAt: null,
      ...overrides,
    },
  } as never;
}

const activeEmployee = {
  jenjang: "4",
  kodeStatpeg: "01",
  statKepeg: "02",
  isPresentInSource: true,
  unitId: "unit-1",
};

describe("protected page authorization", () => {
  it("uses current role state instead of a stale JWT role", async () => {
    findUniqueMock.mock.mockImplementationOnce(async () => ({
      id: "user-1",
      role: "PIC",
      authProvider: "SSO",
      isActive: true,
      unitId: "unit-1",
      passwordChangedAt: null,
      employee: activeEmployee,
    }));

    const result = await authorized({
      auth: session({ role: "ADMIN" }),
      request: request("/admin/dashboard"),
    } as never);

    assert.equal((result as Response).headers.get("location"),
      "http://localhost/pic/halaman-utama");
  });

  it("fails closed when the current provider no longer matches the JWT", async () => {
    findUniqueMock.mock.mockImplementationOnce(async () => ({
      id: "user-1",
      role: "ADMIN",
      authProvider: "LOCAL",
      isActive: true,
      unitId: null,
      passwordChangedAt: new Date(),
      employee: null,
    }));

    const result = await authorized({
      auth: session({ authProvider: "SSO" }),
      request: request("/admin/dashboard"),
    } as never);

    assert.equal((result as Response).headers.get("location"),
      "http://localhost/login");
  });

  it("keeps unauthenticated public login routes public", async () => {
    const result = await authorized({
      auth: null,
      request: request("/login/admin"),
    } as never);

    assert.equal(result, true);
    assert.equal(findUniqueMock.mock.callCount(), 0);
  });

  it("enforces expired LOCAL passwords before role-route redirects", async () => {
    findUniqueMock.mock.mockImplementationOnce(async () => ({
      id: "user-1",
      role: "PIC",
      authProvider: "LOCAL",
      isActive: true,
      unitId: "unit-1",
      passwordChangedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      employee: null,
    }));

    const result = await authorized({
      auth: session({ authProvider: "LOCAL", role: "PIC" }),
      request: request("/admin/dashboard"),
    } as never);

    assert.equal(
      (result as Response).headers.get("location"),
      "http://localhost/settings/change-password",
    );
  });

  it("allows an expired LOCAL user to reach the password-change page", async () => {
    findUniqueMock.mock.mockImplementationOnce(async () => ({
      id: "user-1",
      role: "ADMIN",
      authProvider: "LOCAL",
      isActive: true,
      unitId: null,
      passwordChangedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      employee: null,
    }));

    const result = await authorized({
      auth: session({ authProvider: "LOCAL" }),
      request: request("/settings/change-password"),
    } as never);

    assert.equal(result, true);
  });
});
