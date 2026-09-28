import assert from "node:assert/strict";
import { before, it, mock } from "node:test";
import { NextRequest } from "next/server";

type Authorization = { session: { user: { id: string } } } | { response: Response };
const authorizeMock = mock.fn<(request: NextRequest) => Promise<Authorization>>(async () => ({ session: { user: { id: "admin-1" } } }));
const readMock = mock.fn<(request: NextRequest, allowedFields: readonly string[]) => Promise<{ file: { name: string }; bytes: Buffer }>>(async () => ({ file: { name: "staff.xlsx" }, bytes: Buffer.from("opaque") }));
const previewMock = mock.fn<(adminId: string, fileName: string, bytes: Buffer) => Promise<{
  previewToken: string; expiresAt: Date; rowCount: number;
  impact: { newCount: number; changedCount: number; unchangedCount: number; missingCount: number; deactivationCount: number; details: Array<{ nip: string; change: "NEW" }> };
}>>(async () => ({
  previewToken: "A".repeat(43), expiresAt: new Date("2026-09-28T00:15:00.000Z"), rowCount: 1,
  impact: { newCount: 1, changedCount: 0, unchangedCount: 0, missingCount: 0, deactivationCount: 0, details: [{ nip: "001", change: "NEW" }] },
}));
mock.module("@/lib/employee-import-http", {
  namedExports: {
    authorizeEmployeeImport: authorizeMock,
    readEmployeeImportForm: readMock,
    employeeImportErrorResponse: () => Response.json({}, { status: 500 }),
  },
});
mock.module("@/lib/employee-excel-import", { namedExports: { previewEmployeeImport: previewMock } });

let POST: (request: NextRequest) => Promise<Response>;
before(async () => { ({ POST } = await import("./route")); });

it("parses through the Admin-gated upload seam and returns bounded preview data", async () => {
  const response = await POST(new NextRequest("http://localhost/api/employees/import/preview", { method: "POST", body: "unused" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.previewToken, "A".repeat(43));
  assert.equal(body.data.impact.details.length, 1);
  assert.deepEqual(readMock.mock.calls[0]?.arguments[1], ["file"]);
  assert.equal(previewMock.mock.calls[0]?.arguments[0], "admin-1");
});

it("does not parse multipart input when Admin authorization fails", async () => {
  authorizeMock.mock.mockImplementationOnce(async () => ({ response: Response.json({}, { status: 403 }) }));
  readMock.mock.resetCalls();
  const response = await POST(new NextRequest("http://localhost/api/employees/import/preview", { method: "POST", body: "unused" }));
  assert.equal(response.status, 403);
  assert.equal(readMock.mock.callCount(), 0);
});
