import assert from "node:assert/strict";
import { before, it, mock } from "node:test";
import { NextRequest } from "next/server";

type Authorization = { session: { user: { id: string } } } | { response: Response };
const authorizeMock = mock.fn<(request: NextRequest) => Promise<Authorization>>(async () => ({ session: { user: { id: "admin-1" } } }));
const templateMock = mock.fn<() => Promise<ArrayBuffer>>(async () => new ArrayBuffer(4));
mock.module("@/lib/employee-import-http", {
  namedExports: { authorizeEmployeeImport: authorizeMock, employeeImportErrorResponse: () => Response.json({}, { status: 500 }) },
});
mock.module("@/lib/employee-excel-import", {
  namedExports: { createEmployeeImportTemplate: templateMock },
});

let GET: (request: NextRequest) => Promise<Response>;
before(async () => { ({ GET } = await import("./route")); });

it("requires the shared Admin gate and serves a private xlsx template", async () => {
  const response = await GET(new NextRequest("http://localhost/api/employees/import/template"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /spreadsheetml\.sheet/);
  assert.match(response.headers.get("content-disposition") ?? "", /Template_Employee_Pentaho\.xlsx/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(authorizeMock.mock.callCount(), 1);
  assert.equal(templateMock.mock.callCount(), 1);
});

it("returns the authorization response without generating a template", async () => {
  authorizeMock.mock.mockImplementationOnce(async () => ({ response: Response.json({}, { status: 403 }) }));
  templateMock.mock.resetCalls();
  const response = await GET(new NextRequest("http://localhost/api/employees/import/template"));
  assert.equal(response.status, 403);
  assert.equal(templateMock.mock.callCount(), 0);
});
