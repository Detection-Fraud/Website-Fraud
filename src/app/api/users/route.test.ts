import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

const authMock = mock.fn(
  async (): Promise<{
    user: { id: string; role: string };
  } | null> => ({
    user: { id: "admin", role: "ADMIN" },
  }),
);

const listPicUsersMock = mock.fn(async () => {
  throw new Error("listPicUsers must not be called before authorization");
});

const createOrLinkUserMock = mock.fn(async () => {
  throw new Error("createOrLinkUser must not be called in this test");
});

mock.module("@/auth", {
  namedExports: {
    auth: authMock,
  },
});

mock.module("@/lib/user-management", {
  namedExports: {
    listPicUsers: listPicUsersMock,
    createOrLinkUser: createOrLinkUserMock,
  },
});

let GET: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

describe("GET /api/users", () => {
  it("returns exact 401 for unauthenticated access before downstream data access", async () => {
    authMock.mock.mockImplementationOnce(async () => null);

    const response = await GET(
      new NextRequest("http://localhost/api/users"),
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      status: 401,
      error: true,
      message: "Unauthorized",
      data: null,
    });
    assert.equal(listPicUsersMock.mock.callCount(), 0);
  });

  it("returns exact 403 for non-ADMIN access before downstream data access", async () => {
    authMock.mock.mockImplementationOnce(async () => ({
      user: { id: "viewer", role: "VIEWER" },
    }));

    const response = await GET(
      new NextRequest("http://localhost/api/users"),
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      status: 403,
      error: true,
      message: "Hanya Admin yang dapat mengakses",
      data: null,
    });
    assert.equal(listPicUsersMock.mock.callCount(), 0);
  });
});
