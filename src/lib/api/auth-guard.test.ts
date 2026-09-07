import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";

const authMock = mock.fn<(...args: any[]) => Promise<unknown>>(
  async () => undefined,
);

const findUniqueMock = mock.fn<(...args: any[]) => Promise<unknown>>(
  async () => undefined,
);

type DbEmployee = {
  jenjang: string;
  kodeStatpeg: string;
  statKepeg: string;
  isPresentInSource: boolean;
  unitId: string | null;
};

type DbUser = {
  id: string;
  name: string;
  username: string | null;
  role: string;
  authProvider: string;
  isActive: boolean;
  unitId: string | null;
  unit: unknown | null;
  employee: DbEmployee | null;
};

mock.module("@/auth", {
  namedExports: {
    auth: authMock,
  },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: {
        findUnique: findUniqueMock,
      },
    },
  },
});

let requireAuth: typeof import("./auth-guard").requireAuth;
let requireAdmin: typeof import("./auth-guard").requireAdmin;
let requirePic: typeof import("./auth-guard").requirePic;
let handleApiError: typeof import("./auth-guard").handleApiError;

const baseDbUser: DbUser = {
  id: "user-1",
  name: "Test User",
  username: "test-user",
  role: "ADMIN",
  authProvider: "LOCAL",
  isActive: true,
  unitId: null,
  unit: null,
  employee: null,
};

function setSession(authProvider: string | null = "LOCAL") {
  authMock.mock.mockImplementation(async () => ({
    user: {
      id: "user-1",
      name: "Session User",
      username: "test-user",
      role: "ADMIN",
      unitId: null,
      unitName: null,
      unitType: null,
      parentUnitId: null,
      parentUnitName: null,
      passwordChangedAt: null,
      authProvider,
    },
  }));
}

function setDbUser(overrides: Partial<DbUser> = {}) {
  findUniqueMock.mock.mockImplementation(async () => ({
    ...baseDbUser,
    ...overrides,
  }));
}

async function assertForbidden(operation: () => Promise<unknown>) {
  await assert.rejects(operation, (error: unknown) => {
    return (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 403
    );
  });
}

before(async () => {
  ({ requireAuth, requireAdmin, requirePic, handleApiError } =
    await import("./auth-guard"));
});

beforeEach(() => {
  authMock.mock.resetCalls();
  findUniqueMock.mock.resetCalls();
});

describe("current API authorization", () => {
  it("rejects an inactive User", async () => {
    setSession("LOCAL");
    setDbUser({ isActive: false });

    await assertForbidden(() => requireAuth());
  });

  it("rejects a provider mismatch", async () => {
    setSession("SSO");
    setDbUser({ authProvider: "LOCAL" });

    await assertForbidden(() => requireAuth());
  });

  it("rejects SSO access without an Employee", async () => {
    setSession("SSO");
    setDbUser({
      role: "ADMIN",
      authProvider: "SSO",
      employee: null,
    });

    await assertForbidden(() => requireAuth());
  });

  it("rejects SSO PIC with absent source presence", async () => {
    setSession("SSO");
    setDbUser({
      role: "PIC",
      authProvider: "SSO",
      unitId: "unit-1",
      employee: {
        jenjang: "4",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: false,
        unitId: "unit-1",
      },
    });

    await assertForbidden(() => requirePic());
  });

  it("rejects SSO PIC when Employee and User units differ", async () => {
    setSession("SSO");
    setDbUser({
      role: "PIC",
      authProvider: "SSO",
      unitId: "unit-1",
      employee: {
        jenjang: "4",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: true,
        unitId: "unit-2",
      },
    });

    await assertForbidden(() => requirePic());
  });

  it("rejects LOCAL PIC without User.unitId", async () => {
    setSession("LOCAL");
    setDbUser({
      role: "PIC",
      authProvider: "LOCAL",
      unitId: null,
    });

    await assertForbidden(() => requirePic());
  });

  it("allows active LOCAL Admin without an Employee", async () => {
    setSession("LOCAL");
    setDbUser({
      role: "ADMIN",
      authProvider: "LOCAL",
      employee: null,
    });

    const session = await requireAdmin();

    assert.equal(session.user.id, "user-1");
    assert.equal(session.user.role, "ADMIN");
  });
});

describe("handleApiError", () => {
  it("maps unique and transaction conflicts to 409", async () => {
    for (const code of ["P2002", "P2034"]) {
      const response = handleApiError({ code }, "test");
      const body = await response.json();

      assert.equal(response.status, 409);
      assert.equal(body.error, true);
    }
  });
});
