import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

mock.module("@/auth", {
  namedExports: {
    auth: mock.fn(async () => ({
      user: { id: "admin", role: "ADMIN" },
    })),
  },
});

const userCreateMock = mock.fn();
const userUpdateMock = mock.fn();
const userUpsertMock = mock.fn();
const userDeleteMock = mock.fn();
const userDeleteManyMock = mock.fn();

const employeeCreateMock = mock.fn();
const employeeUpdateMock = mock.fn();
const employeeUpsertMock = mock.fn();
const employeeDeleteMock = mock.fn();
const employeeDeleteManyMock = mock.fn();

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: {
        create: userCreateMock,
        update: userUpdateMock,
        upsert: userUpsertMock,
        delete: userDeleteMock,
        deleteMany: userDeleteManyMock,
      },
      employee: {
        create: employeeCreateMock,
        update: employeeUpdateMock,
        upsert: employeeUpsertMock,
        delete: employeeDeleteMock,
        deleteMany: employeeDeleteManyMock,
      },
    },
  },
});

let POST: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ POST } = await import("./route"));
});

describe("POST /api/users/import", () => {
  it("returns 410 for legacy commit without mutating User or Employee records", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/users/import?action=commit", {
        method: "POST",
        body: "{}",
      }),
    );

    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), {
      status: 410,
      error: true,
      message:
        "Import karyawan legacy hanya menyediakan preview; gunakan sinkronisasi Employee resmi",
      data: null,
    });

    assert.equal(userCreateMock.mock.callCount(), 0);
    assert.equal(userUpdateMock.mock.callCount(), 0);
    assert.equal(userUpsertMock.mock.callCount(), 0);
    assert.equal(userDeleteMock.mock.callCount(), 0);
    assert.equal(userDeleteManyMock.mock.callCount(), 0);

    assert.equal(employeeCreateMock.mock.callCount(), 0);
    assert.equal(employeeUpdateMock.mock.callCount(), 0);
    assert.equal(employeeUpsertMock.mock.callCount(), 0);
    assert.equal(employeeDeleteMock.mock.callCount(), 0);
    assert.equal(employeeDeleteManyMock.mock.callCount(), 0);
  });
});
