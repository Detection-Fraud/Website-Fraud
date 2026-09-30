import assert from "node:assert/strict";
import { before, beforeEach, mock, test } from "node:test";

const authMock = mock.fn(async () => null as any);
const countMock = mock.fn<(...args: any[]) => Promise<number>>(async () => 0);

class TestApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function requireAuthMock() {
  const session = await authMock();
  if (!session) throw new TestApiError("Unauthorized", 401);
  return session;
}

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    requireAuth: requireAuthMock,
    handleApiError: (error: unknown) => {
      const status = error instanceof TestApiError ? error.status : 500;
      return Response.json(
        {
          status,
          error: true,
          message: error instanceof Error ? error.message : "Internal error",
          data: null,
        },
        { status },
      );
    },
  },
});

mock.module("@/lib/prisma", {
  namedExports: { prisma: { activityReport: { count: countMock } } },
});

let GET: () => Promise<Response>;
before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  authMock.mock.resetCalls();
  countMock.mock.resetCalls();
  countMock.mock.mockImplementation(async () => 0);
});

test("PIC hanya menghitung laporan REJECTED miliknya pada unit yang sama", async () => {
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "pic-1", role: "PIC", unitId: "unit-1" },
  }));
  countMock.mock.mockImplementationOnce(async () => 2);

  const response = await GET();
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(result.data, { count: 2 });
  assert.deepEqual(countMock.mock.calls[0].arguments[0], {
    where: { unitId: "unit-1", createdById: "pic-1", status: "REJECTED" },
  });
});

test("non-PIC menerima count nol tanpa query", async () => {
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "viewer-1", role: "VIEWER", unitId: "unit-1" },
  }));

  const response = await GET();
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(result.data, { count: 0 });
  assert.equal(countMock.mock.callCount(), 0);
});

test("request tanpa session menerima 401 tanpa query", async () => {
  authMock.mock.mockImplementationOnce(async () => null);

  const response = await GET();

  assert.equal(response.status, 401);
  assert.equal(countMock.mock.callCount(), 0);
});
