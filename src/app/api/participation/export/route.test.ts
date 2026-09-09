import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

const requireAdminMock = mock.fn<(...args: any[]) => Promise<any>>(async () => undefined);
const buildParticipationExportMock = mock.fn<(...args: any[]) => Promise<any>>(async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer);
let nextAuthError: Error | null = null;
let nextExportError: Error | null = null;

class TestApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

mock.module("@/lib/api/auth-guard", { namedExports: {
  requireAdmin: requireAdminMock,
  handleApiError: (error: unknown) => error instanceof TestApiError
    ? Response.json({ status: error.status, error: true, message: error.message, data: null }, { status: error.status })
    : Response.json({ status: 500, error: true, message: "internal", data: null }, { status: 500 }),
} });
mock.module("@/lib/participation-workbook/service", { namedExports: { buildParticipationExport: buildParticipationExportMock } });

let GET: typeof import("./route")["GET"];

before(async () => { ({ GET } = await import("./route")); });

beforeEach(() => {
  requireAdminMock.mock.resetCalls();
  buildParticipationExportMock.mock.resetCalls();
  nextAuthError = null;
  nextExportError = null;
  requireAdminMock.mock.mockImplementation(async () => {
    if (nextAuthError) throw nextAuthError;
  });
  buildParticipationExportMock.mock.mockImplementation(async () => {
    if (nextExportError) throw nextExportError;
    return new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
  });
});

function request(query = "?categoryId=22222222-2222-4222-8222-222222222222&tw=2&year=2026") {
  return new NextRequest(`http://localhost/api/participation/export${query}`);
}

describe("GET /api/participation/export", () => {
  it("Admin receives XLSX binary with the validated filter", async () => {
    const response = await GET(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.equal(response.headers.get("Content-Disposition"), 'attachment; filename="Export_Partisipasi_TW2_2026.xlsx"');
    assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), [0x50, 0x4b, 0x03, 0x04]);
    assert.deepEqual(buildParticipationExportMock.mock.calls[0]?.arguments[0], { categoryId: "22222222-2222-4222-8222-222222222222", tw: 2, year: 2026 });
  });

  it("rejects invalid filters before export work", async () => {
    const response = await GET(request("?categoryId=not-a-uuid&tw=9&year=2026"));
    assert.equal(response.status, 400);
    assert.equal(buildParticipationExportMock.mock.callCount(), 0);
  });

  for (const [label, status] of [["PIC", 403], ["VIEWER", 403], ["unauthenticated", 401]] as const) {
    it(`${label} is rejected before export work`, async () => {
      nextAuthError = new TestApiError(status === 401 ? "Unauthorized" : "Hanya Admin yang dapat mengakses", status);
      const response = await GET(request());
      assert.equal(response.status, status);
      assert.equal(buildParticipationExportMock.mock.callCount(), 0);
    });
  }

  it("returns incomplete frozen-field failure from the export service", async () => {
    nextExportError = new TestApiError("Data historis unit unit-1 tidak memiliki frozen field yang lengkap", 409);
    const response = await GET(request());
    assert.equal(response.status, 409);
    assert.equal(buildParticipationExportMock.mock.callCount(), 1);
  });
});
