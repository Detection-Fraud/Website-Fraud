import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

const requireAdminMock = mock.fn(async () => ({
  user: { id: "admin-1", role: "ADMIN" },
}));
const applyEmployeeAdminActionMock = mock.fn(async () => ({
  id: "user-1",
  role: "ADMIN",
  authProvider: "SSO",
  isActive: false,
}));

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    requireAdmin: requireAdminMock,
    handleApiError: (error: unknown) =>
      new Response(JSON.stringify({ error: true, message: String(error) }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
  },
});

mock.module("@/lib/user-management", {
  namedExports: { applyEmployeeAdminAction: applyEmployeeAdminActionMock },
});

let PATCH: (request: NextRequest, context: { params: Promise<{ employeeId: string }> }) => Promise<Response>;

before(async () => {
  ({ PATCH } = await import("./route"));
});

describe("PATCH /api/employees/[employeeId]/account", () => {
  it("requires Admin before parsing or calling the service", async () => {
    requireAdminMock.mock.mockImplementationOnce(async () => {
      throw new Error("unauthorized");
    });

    const response = await PATCH(
      new NextRequest("http://localhost/api/employees/employee-1/account", {
        method: "PATCH",
        body: JSON.stringify({ action: "ENSURE_ADMIN" }),
      }),
      { params: Promise.resolve({ employeeId: "employee-1" }) },
    );

    assert.equal(response.status, 500);
    assert.equal(applyEmployeeAdminActionMock.mock.callCount(), 0);
  });

  it("rejects unknown action fields before calling the service", async () => {
    applyEmployeeAdminActionMock.mock.resetCalls();

    const response = await PATCH(
      new NextRequest("http://localhost/api/employees/00000000-0000-4000-8000-000000000001/account", {
        method: "PATCH",
        body: JSON.stringify({ action: "ENSURE_ADMIN", unexpected: true }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ employeeId: "00000000-0000-4000-8000-000000000001" }) },
    );

    assert.equal(response.status, 400);
    assert.equal(applyEmployeeAdminActionMock.mock.callCount(), 0);
  });

  it("rejects a malformed Employee UUID before service access", async () => {
    applyEmployeeAdminActionMock.mock.resetCalls();

    const response = await PATCH(
      new NextRequest("http://localhost/api/employees/not-a-uuid/account", {
        method: "PATCH",
        body: JSON.stringify({ action: "ENSURE_ADMIN" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ employeeId: "not-a-uuid" }) },
    );

    assert.equal(response.status, 400);
    assert.equal(applyEmployeeAdminActionMock.mock.callCount(), 0);
  });

  it("rejects malformed JSON before service access", async () => {
    applyEmployeeAdminActionMock.mock.resetCalls();

    const response = await PATCH(
      new NextRequest("http://localhost/api/employees/00000000-0000-4000-8000-000000000001/account", {
        method: "PATCH",
        body: "{",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ employeeId: "00000000-0000-4000-8000-000000000001" }) },
    );

    assert.equal(response.status, 400);
    assert.equal(applyEmployeeAdminActionMock.mock.callCount(), 0);
  });

  it("passes the authenticated Admin actor and Employee route id to the service", async () => {
    applyEmployeeAdminActionMock.mock.resetCalls();

    const response = await PATCH(
      new NextRequest("http://localhost/api/employees/00000000-0000-4000-8000-000000000001/account", {
        method: "PATCH",
        body: JSON.stringify({ action: "ENSURE_ADMIN" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ employeeId: "00000000-0000-4000-8000-000000000001" }) },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(applyEmployeeAdminActionMock.mock.calls[0]?.arguments, [
      "00000000-0000-4000-8000-000000000001",
      "admin-1",
      { action: "ENSURE_ADMIN" },
    ]);
  });
});
