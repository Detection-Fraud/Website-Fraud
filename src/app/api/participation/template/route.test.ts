import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { NextRequest } from "next/server";

const authMock = mock.fn<(...args: any[]) => Promise<any>>(async () => null);
const categoryFindUniqueMock = mock.fn<(...args: any[]) => Promise<any>>(async () => null);
const unitFindManyMock = mock.fn<(...args: any[]) => Promise<any>>(async () => []);
const worksheet = {
  addRow: mock.fn(),
  getRow: mock.fn(() => ({ font: {} })),
  getColumn: mock.fn(() => ({ width: 0 })),
};
const writeBufferMock = mock.fn<(...args: any[]) => Promise<any>>(
  async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
);
const addWorksheetMock = mock.fn(() => worksheet);
const workbook = {
  addWorksheet: addWorksheetMock,
  xlsx: { writeBuffer: writeBufferMock },
};
const workbookConstructorMock = mock.fn(function () {
  return workbook;
});

mock.module("@/auth", { namedExports: { auth: authMock } });
mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      programCategory: { findUnique: categoryFindUniqueMock },
      unit: { findMany: unitFindManyMock },
    },
  },
});
mock.module("exceljs", {
  defaultExport: { Workbook: workbookConstructorMock },
  namedExports: {
    default: { Workbook: workbookConstructorMock },
    Workbook: workbookConstructorMock,
  },
});

let GET: (request: NextRequest) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

beforeEach(() => {
  authMock.mock.resetCalls();
  categoryFindUniqueMock.mock.resetCalls();
  unitFindManyMock.mock.resetCalls();
  addWorksheetMock.mock.resetCalls();
  workbookConstructorMock.mock.resetCalls();
  writeBufferMock.mock.resetCalls();
  worksheet.addRow.mock.resetCalls();
  worksheet.getRow.mock.resetCalls();
  worksheet.getColumn.mock.resetCalls();
  authMock.mock.mockImplementation(async () => ({
    user: { id: "admin-1", role: "ADMIN" },
  }));
  categoryFindUniqueMock.mock.mockImplementation(async () => ({
    name: "TOGA Excel",
    targetUnit: "PARTISIPASI_PERSEN",
    evidenceMode: "NONE",
    scoreInputMode: "EXCEL_IMPORT",
  }));
  unitFindManyMock.mock.mockImplementation(async () => [
    { name: "Unit A" },
    { name: "Unit B" },
  ]);
});

function request(
  query = "?categoryId=22222222-2222-4222-8222-222222222222&tw=2&year=2026",
) {
  return new NextRequest(`http://localhost/api/participation/template${query}`);
}

describe("GET /api/participation/template", () => {
  it("mengembalikan template binary untuk Admin dengan tuple exact", async () => {
    const response = await GET(request());

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("Content-Type"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    assert.equal(
      response.headers.get("Content-Disposition"),
      'attachment; filename="Template_Partisipasi_TOGA_Excel_TW2_2026.xlsx"',
    );
    assert.deepEqual(
      Array.from(new Uint8Array(await response.arrayBuffer())),
      [0x50, 0x4b, 0x03, 0x04],
    );
    assert.equal(categoryFindUniqueMock.mock.callCount(), 1);
    assert.equal(unitFindManyMock.mock.callCount(), 1);
    assert.equal(workbookConstructorMock.mock.callCount(), 1);
    assert.equal(writeBufferMock.mock.callCount(), 1);
    assert.deepEqual(categoryFindUniqueMock.mock.calls[0].arguments[0], {
      where: { id: "22222222-2222-4222-8222-222222222222" },
      select: {
        name: true,
        targetUnit: true,
        evidenceMode: true,
        scoreInputMode: true,
      },
    });
    assert.deepEqual(worksheet.addRow.mock.calls[2].arguments[0], [
      "NO",
      "UNIT KERJA",
      "PERSENTASE (%)",
    ]);
  });

  for (const [role, expectedStatus] of [
    ["PIC", 403],
    ["VIEWER", 403],
  ] as const) {
    it(`${role} ditolak sebelum query category, unit, dan workbook`, async () => {
      authMock.mock.mockImplementationOnce(async () => ({
        user: { id: `${role.toLowerCase()}-1`, role },
      }));

      const response = await GET(request());

      assert.equal(response.status, expectedStatus);
      assert.equal(categoryFindUniqueMock.mock.callCount(), 0);
      assert.equal(unitFindManyMock.mock.callCount(), 0);
      assert.equal(workbookConstructorMock.mock.callCount(), 0);
    });
  }

  it("request tanpa session menerima 401 sebelum pekerjaan lain", async () => {
    authMock.mock.mockImplementationOnce(async () => null);

    const response = await GET(request());

    assert.equal(response.status, 401);
    assert.equal(categoryFindUniqueMock.mock.callCount(), 0);
    assert.equal(unitFindManyMock.mock.callCount(), 0);
    assert.equal(workbookConstructorMock.mock.callCount(), 0);
  });

  it("filter invalid menerima 400 sebelum lookup category", async () => {
    const response = await GET(
      request("?categoryId=not-a-uuid&tw=9&year=2026"),
    );

    assert.equal(response.status, 400);
    assert.equal(categoryFindUniqueMock.mock.callCount(), 0);
    assert.equal(unitFindManyMock.mock.callCount(), 0);
    assert.equal(workbookConstructorMock.mock.callCount(), 0);
  });

  it("missing capability menerima 422 sebelum unit query dan generation", async () => {
    categoryFindUniqueMock.mock.mockImplementationOnce(async () => null);

    const response = await GET(request());

    assert.equal(response.status, 422);
    assert.equal(unitFindManyMock.mock.callCount(), 0);
    assert.equal(workbookConstructorMock.mock.callCount(), 0);
    assert.equal(writeBufferMock.mock.callCount(), 0);
  });

  for (const capability of [
    {
      targetUnit: "PARTISIPASI_PERSEN",
      evidenceMode: "PHOTO_WITHOUT_AI",
      scoreInputMode: "DIRECT_ADMIN",
    },
    {
      targetUnit: "KEGIATAN",
      evidenceMode: "PHOTO_WITH_AI",
      scoreInputMode: "NONE",
    },
  ]) {
    it(`unsupported capability ${capability.scoreInputMode} menerima 422 sebelum pekerjaan mahal`, async () => {
      categoryFindUniqueMock.mock.mockImplementationOnce(async () => ({
        name: "Unsupported",
        ...capability,
      }));

      const response = await GET(request());

      assert.equal(response.status, 422);
      assert.equal(unitFindManyMock.mock.callCount(), 0);
      assert.equal(workbookConstructorMock.mock.callCount(), 0);
      assert.equal(writeBufferMock.mock.callCount(), 0);
    });
  }
});
