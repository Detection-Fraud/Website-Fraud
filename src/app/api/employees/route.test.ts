import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import { NextRequest, NextResponse } from "next/server";

const requireAdminMock = mock.fn(async () => ({
  user: {
    id: "admin",
    role: "ADMIN",
  },
}));

const listEmployeesMock = mock.fn(async (input: unknown) => ({
  employees: [],
  pagination: {
    total: 0,
    page: (input as { page: number }).page,
    limit: (input as { limit: number }).limit,
    totalPages: 0,
  },
}));

const handleApiErrorMock = mock.fn(() =>
  NextResponse.json(
    {
      status: 500,
      error: true,
      message: "Terjadi kesalahan internal pada server",
      data: null,
    },
    { status: 500 },
  ),
);

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    requireAdmin: requireAdminMock,
    handleApiError: handleApiErrorMock,
  },
});

mock.module("@/lib/user-management", {
  namedExports: {
    listEmployeesForManagement: listEmployeesMock,
  },
});

let GET: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

describe("GET /api/employees", () => {
  it("requires Admin authorization before service access", async () => {
    requireAdminMock.mock.mockImplementationOnce(async () => {
      throw new Error("unauthorized");
    });

    const response = await GET(
      new NextRequest("http://localhost/api/employees"),
    );

    assert.equal(response.status, 500);
    assert.equal(listEmployeesMock.mock.callCount(), 0);
    assert.equal(handleApiErrorMock.mock.callCount(), 1);
  });

  it("parses bounded filters and delegates the validated query", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/employees?search=andi&source=PRESENT&employment=ACTIVE&account=LINKED&role=PIC&page=2&limit=25",
      ),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(listEmployeesMock.mock.calls.at(-1)?.arguments[0], {
      search: "andi",
      source: "PRESENT",
      employment: "ACTIVE",
      account: "LINKED",
      role: "PIC",
      page: 2,
      limit: 25,
    });
  });

  it("rejects invalid query values before service access", async () => {
    const callsBefore = listEmployeesMock.mock.callCount();

    const response = await GET(
      new NextRequest(
        "http://localhost/api/employees?source=UNKNOWN&limit=1000",
      ),
    );

    assert.equal(response.status, 400);
    assert.equal(listEmployeesMock.mock.callCount(), callsBefore);
    assert.deepEqual(await response.json(), {
      status: 400,
      error: true,
      message: "Validasi parameter gagal",
      data: null,
    });
  });
});
