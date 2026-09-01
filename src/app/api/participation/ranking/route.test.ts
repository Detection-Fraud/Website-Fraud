import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

const authMock = mock.fn(async () => null as any);
const unitFindManyMock = mock.fn(async () => []);
const participationFindManyMock = mock.fn(async () => []);

mock.module("@/auth", {
  namedExports: { auth: authMock },
});
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      unit: { findMany: unitFindManyMock },
      participationData: { findMany: participationFindManyMock },
    },
  },
});

let GET: (req: NextRequest) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

function request() {
  return new NextRequest("http://localhost/api/participation/ranking");
}

async function responseBody(response: Response) {
  return response.json() as Promise<{
    status: number;
    error: boolean;
    message: string;
    data: unknown;
  }>;
}

test("ADMIN can read ranking and receives the bounded success envelope", async () => {
  authMock.mock.mockImplementationOnce(async () => ({
    user: { id: "admin-1", role: "ADMIN" },
  }));

  const response = await GET(request());
  const body = await responseBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.error, false);
  assert.deepEqual(body.data, { ranking: [], categories: [], total: 0 });
  assert.equal(unitFindManyMock.mock.callCount(), 1);
  assert.equal(participationFindManyMock.mock.callCount(), 1);
});

for (const [role, expectedStatus] of [
  ["PIC", 403],
  ["VIEWER", 403],
] as const) {
  test(`${role} cannot read ranking`, async () => {
    authMock.mock.mockImplementationOnce(async () => ({
      user: { id: `${role.toLowerCase()}-1`, role },
    }));

    const response = await GET(request());
    const body = await responseBody(response);

    assert.equal(response.status, expectedStatus);
    assert.equal(body.error, true);
    assert.equal(body.status, expectedStatus);
    assert.equal(body.data, null);
  });
}

test("an unauthenticated request cannot read ranking", async () => {
  authMock.mock.mockImplementationOnce(async () => null);

  const response = await GET(request());
  const body = await responseBody(response);

  assert.equal(response.status, 401);
  assert.equal(body.error, true);
  assert.equal(body.status, 401);
  assert.equal(body.data, null);
});
