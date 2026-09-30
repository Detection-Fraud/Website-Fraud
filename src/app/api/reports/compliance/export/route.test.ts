import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

const activeUnits = [
  {
    id: "divisi-1",
    name: "Divisi 1",
    type: "DIVISI",
    wilayah: "Kantor Pusat",
    parentId: null,
  },
  {
    id: "kanwil-10",
    name: "Kanwil 10",
    type: "KANTOR_WILAYAH",
    wilayah: "Wilayah 10",
    parentId: null,
  },
  {
    id: "cabang-2",
    name: "Cabang 2",
    type: "KANTOR_CABANG",
    wilayah: "Wilayah 2",
    parentId: "kanwil-2",
  },
  {
    id: "divisi-missing",
    name: "Divisi Missing",
    type: "DIVISI",
    wilayah: "Kantor Pusat",
    parentId: null,
  },
  {
    id: "kanwil-2",
    name: "Kanwil 2",
    type: "KANTOR_WILAYAH",
    wilayah: "Wilayah 2",
    parentId: null,
  },
  {
    id: "cabang-1",
    name: "Cabang 1",
    type: "KANTOR_CABANG",
    wilayah: "Wilayah 2",
    parentId: "kanwil-2",
  },
];

const codeRows = [
  { id: "cabang-2", kodeDolog: "02", kodeSubdolog: "02", kodeOrg: "S02" },
  { id: "kanwil-10", kodeDolog: "10", kodeSubdolog: "00", kodeOrg: "W10" },
  { id: "divisi-1", kodeDolog: "00", kodeSubdolog: "00", kodeOrg: "E01000" },
  { id: "cabang-1", kodeDolog: "02", kodeSubdolog: "01", kodeOrg: "S01" },
  { id: "kanwil-2", kodeDolog: "02", kodeSubdolog: "00", kodeOrg: "W02" },
];

const unitFindManyMock = mock.fn(async (...args: unknown[]) => {
  void args;
  return codeRows;
});
const categoryFindManyMock = mock.fn(async () => [
  {
    id: "category-1",
    name: "Program TW I",
    programs: [
      {
        id: "program-tw-1",
        tw: 1,
        frequency: 2,
        startDate: new Date("2026-01-15T12:00:00.000Z"),
        endDate: new Date("2026-03-15T12:00:00.000Z"),
      },
    ],
  },
  {
    id: "category-3",
    name: "Program TW III",
    programs: [
      {
        id: "program-tw-3",
        tw: 3,
        frequency: 1,
        startDate: new Date("2026-07-15T12:00:00.000Z"),
        endDate: new Date("2026-09-15T12:00:00.000Z"),
      },
    ],
  },
]);
const queryRawMock = mock.fn(async () => [
  { unitId: "kanwil-2", programId: "program-tw-1", bulan: 1, jumlah: 1 },
  { unitId: "kanwil-10", programId: "program-tw-1", bulan: 1, jumlah: 3 },
]);

mock.module("@/lib/api/auth-guard", {
  namedExports: {
    requireAuth: async () => ({ user: { role: "ADMIN" } }),
    handleApiError: (_error: unknown, message: string) =>
      Response.json({ message }, { status: 500 }),
  },
});

mock.module("@/lib/api/unit-scope", {
  namedExports: {
    resolveScope: async () => ({ activeUnits }),
  },
});

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      unit: { findMany: unitFindManyMock },
      programCategory: { findMany: categoryFindManyMock },
      $queryRaw: queryRawMock,
    },
  },
});

mock.module("@generated/prisma", {
  namedExports: {
    Prisma: {
      join: (values: unknown[]) => ({ values }),
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
      }),
      empty: { empty: true },
    },
  },
});

let GET: (req: Request) => Promise<Response>;

before(async () => {
  ({ GET } = await import("./route"));
});

test("exports deterministically ordered units with 100% target on each sheet", async () => {
  const response = await GET(
    new Request("http://localhost/api/reports/compliance/export?year=2026"),
  );

  assert.equal(response.status, 200);
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["TW I", "TW III", "SEMESTER I", "SEMESTER II"],
  );
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.getCell("B1").value),
    ["UNIT KERJA", "UNIT KERJA", "UNIT KERJA", "UNIT KERJA"],
  );
  assert.deepEqual(
    workbook.getWorksheet("TW I")!.getColumn(2).values.slice(3),
    [
      "Kanwil 2",
      "Cabang 1",
      "Cabang 2",
      "Kanwil 10",
      "Divisi Missing",
      "Divisi 1",
    ],
  );

  const tw1 = workbook.getWorksheet("TW I")!;
  assert.equal(tw1.getCell("J3").value, 0.5);
  assert.equal(tw1.getCell("K3").value, 1);
  assert.equal(tw1.getCell("L3").value, 0.5);
  assert.equal(tw1.getCell("J6").value, 1.5);
  assert.equal(tw1.getCell("K6").value, 1);
  assert.equal(tw1.getCell("L6").value, 1.5);

  for (const sheet of workbook.worksheets) {
    const headerValues = sheet.getRow(1).values as unknown[];
    const averageColumn = headerValues.indexOf("% RATA-RATA");
    const targetColumn = headerValues.indexOf("TARGET KINERJA");
    const achievementColumn = headerValues.indexOf("% CAPAIAN KINERJA");
    assert.ok(averageColumn > 0, `${sheet.name} average column`);
    assert.ok(targetColumn > 0, `${sheet.name} target column`);
    assert.ok(achievementColumn > 0, `${sheet.name} achievement column`);
    assert.equal(sheet.getCell(3, targetColumn).value, 1, sheet.name);
    assert.equal(
      sheet.getCell(3, achievementColumn).value,
      sheet.getCell(3, averageColumn).value,
      sheet.name,
    );
  }

  assert.deepEqual(unitFindManyMock.mock.calls[0]?.arguments[0], {
    where: { id: { in: activeUnits.map(({ id }) => id) } },
    select: { id: true, kodeDolog: true, kodeSubdolog: true, kodeOrg: true },
  });
});
