import assert from "node:assert/strict";
import { before, it, mock } from "node:test";
import { NextRequest } from "next/server";

class EmployeeImportError extends Error {
  constructor(readonly code: string) { super(code); }
}

const adminGuard = mock.fn(async () => ({ user: { id: "admin-1" } }));
const limitCheck = mock.fn((_request: unknown, _options: { clientIdentity: string; keyPrefix: string; max: number; windowMs: number }) => ({ success: true, resetAt: Date.now() + 60_000 }));
const rateResponse = mock.fn(() => Response.json({}, { status: 429 }));
mock.module("@/lib/api/auth-guard", { namedExports: { ApiError: class ApiError extends Error { status = 403; }, requireAdmin: adminGuard } });
mock.module("@/lib/api/rate-limit", { namedExports: { checkRateLimit: limitCheck, rateLimitResponse: rateResponse } });
mock.module("@/lib/employee-excel-import", {
  namedExports: { EMPLOYEE_IMPORT_MAX_FILE_BYTES: 25 * 1024 * 1024, EmployeeImportError },
});

let authorizeEmployeeImport: typeof import("./employee-import-http").authorizeEmployeeImport;
let readEmployeeImportForm: typeof import("./employee-import-http").readEmployeeImportForm;
before(async () => {
  ({ authorizeEmployeeImport, readEmployeeImportForm } = await import("./employee-import-http"));
});

const boundary = "employee-import-boundary";
function multipartFile(bytes: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="staff.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

function request(body: Buffer, headers: HeadersInit = {}): NextRequest {
  const bodyArrayBuffer = body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength,
  ) as ArrayBuffer;
  return new NextRequest("http://localhost/api/employees/import/preview", {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, ...headers },
    body: bodyArrayBuffer,
  });
}

it("bounds the aggregate body when Content-Length is absent before multipart parsing", async () => {
  const oversized = Buffer.alloc(25 * 1024 * 1024 + 64 * 1024 + 1);
  await assert.rejects(readEmployeeImportForm(request(oversized), ["file"]), { code: "FILE_TOO_LARGE" });
});

it("rejects a declared body over the cap before reading it", async () => {
  await assert.rejects(
    readEmployeeImportForm(request(Buffer.from("x"), { "content-length": String(25 * 1024 * 1024 + 64 * 1024 + 1) }), ["file"]),
    { code: "FILE_TOO_LARGE" },
  );
});

it("parses a bounded multipart workbook and keys the rate limit by Admin", async () => {
  const parsed = await readEmployeeImportForm(request(multipartFile(Buffer.from("xlsx-bytes"))), ["file"]);
  assert.equal(parsed.file.name, "staff.xlsx");
  assert.equal(parsed.bytes.toString(), "xlsx-bytes");

  const guarded = await authorizeEmployeeImport(request(Buffer.alloc(0)));
  assert.equal("session" in guarded, true);
  assert.equal(limitCheck.mock.calls.at(-1)?.arguments[1]?.clientIdentity, "admin-1");
});

it("returns the Admin-keyed rate-limit response before any caller parses the body", async () => {
  limitCheck.mock.mockImplementationOnce(() => ({ success: false, resetAt: Date.now() + 60_000 }));
  const result = await authorizeEmployeeImport(request(Buffer.from("unparsed")));
  assert.equal("response" in result, true);
  assert.equal(rateResponse.mock.callCount(), 1);
  assert.equal(limitCheck.mock.calls.at(-1)?.arguments[1]?.clientIdentity, "admin-1");
});
