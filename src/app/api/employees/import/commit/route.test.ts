import assert from "node:assert/strict";
import { before, it, mock } from "node:test";
import { NextRequest } from "next/server";

type Authorization = { session: { user: { id: string } } } | { response: Response };
const authorizeMock = mock.fn<(request: NextRequest) => Promise<Authorization>>(async () => ({ session: { user: { id: "admin-1" } } }));
const readMock = mock.fn<(request: NextRequest, allowedFields: readonly string[]) => Promise<{ form: FormData; file: { name: string }; bytes: Buffer }>>(async () => {
  const form = new FormData();
  form.set("previewToken", "B".repeat(43));
  form.set("confirmFullSnapshot", "true");
  return { form, file: { name: "staff.xlsx" }, bytes: Buffer.from("opaque") };
});
const commitMock = mock.fn<(adminId: string, previewToken: string, fileName: string, bytes: Buffer) => Promise<{
  runId: string; sourceSystem: string; channel: "EXCEL_IMPORT"; status: "SUCCEEDED";
  receivedCount: number; processedCount: number; missingCount: number; deactivatedCount: number;
}>>(async () => ({
  runId: "00000000-0000-4000-8000-000000000001", sourceSystem: "PENTAHO", channel: "EXCEL_IMPORT",
  status: "SUCCEEDED", receivedCount: 1, processedCount: 1, missingCount: 0, deactivatedCount: 0,
}));
mock.module("@/lib/employee-import-http", {
  namedExports: {
    authorizeEmployeeImport: authorizeMock,
    readEmployeeImportForm: readMock,
    employeeImportErrorResponse: () => Response.json({}, { status: 500 }),
  },
});
mock.module("@/lib/employee-excel-import", {
  namedExports: { commitEmployeeImport: commitMock, EmployeeImportError: class EmployeeImportError extends Error {} },
});

let POST: (request: NextRequest) => Promise<Response>;
before(async () => { ({ POST } = await import("./route")); });

it("requires an explicit full-snapshot confirmation and returns only safe run fields", async () => {
  const response = await POST(new NextRequest("http://localhost/api/employees/import/commit", { method: "POST", body: "unused" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.channel, "EXCEL_IMPORT");
  assert.equal(body.data.status, "SUCCEEDED");
  assert.equal(body.data.externalJobName, undefined);
  assert.equal(commitMock.mock.calls[0]?.arguments[0], "admin-1");
  assert.equal(commitMock.mock.calls[0]?.arguments[1], "B".repeat(43));
});

it("does not parse the upload when Admin authorization fails", async () => {
  authorizeMock.mock.mockImplementationOnce(async () => ({ response: Response.json({}, { status: 403 }) }));
  readMock.mock.resetCalls();
  const response = await POST(new NextRequest("http://localhost/api/employees/import/commit", { method: "POST", body: "unused" }));
  assert.equal(response.status, 403);
  assert.equal(readMock.mock.callCount(), 0);
});
