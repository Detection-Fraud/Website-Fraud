import assert from "node:assert/strict";
import { before, it, mock } from "node:test";

const requireAdminMock = mock.fn(async () => ({ user: { id: "admin", role: "ADMIN" } }));
class MockApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
mock.module("@/lib/api/auth-guard", {
  namedExports: { requireAdmin: requireAdminMock, ApiError: MockApiError },
});

let GET: () => Promise<Response>;
before(async () => { ({ GET } = await import("./route")); });

it("returns 410 for the retired 9-column template route", async () => {
  const response = await GET();
  assert.equal(response.status, 410);
  const body = await response.json();
  assert.equal(body.message, "Template User legacy dinonaktifkan; gunakan template Employee resmi");
});
