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
    id: "cabang-orphan",
    name: "Cabang Orphan",
    type: "KANTOR_CABANG",
    wilayah: "Wilayah Orphan",
    parentId: "missing-kanwil",
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
  { id: "cabang-orphan", kodeDolog: "01", kodeSubdolog: "01", kodeOrg: "S01" },
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
    id: "category-1b",
    name: "Program TW I 2",
    programs: [
      {
        id: "program-tw-1b",
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
  { unitId: "kanwil-2", programId: "program-tw-1b", bulan: 1, jumlah: 1 },
  { unitId: "kanwil-10", programId: "program-tw-1b", bulan: 1, jumlah: 3 },
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
      "",
      "Cabang 1",
      "",
      "Cabang 2",
      "",
      "Kanwil 10",
      "",
      "Cabang Orphan",
      "",
      "Divisi Missing",
      "",
      "Divisi 1",
      "",
    ],
  );

  const tw1 = workbook.getWorksheet("TW I")!;
  assert.equal(tw1.getCell("J3").value, 0.5);
  assert.equal(tw1.getCell("K3").value, 1);
  assert.equal(tw1.getCell("L3").value, 0.5);
  assert.equal(tw1.getCell("J9").value, 1.2);
  assert.equal(tw1.getCell("K9").value, 1);
  assert.equal(tw1.getCell("L9").value, 1.2);

  for (const sheet of workbook.worksheets) {
    const expectedUnitNumbers =
      sheet.name === "TW I" || sheet.name === "SEMESTER I"
        ? [1, "", "", "", "", "", 2, "", "", "", 3, "", 4, ""]
        : [1, "", "", 2, "", 3, 4];
    assert.deepEqual(
      sheet.getColumn(1).values.slice(3),
      expectedUnitNumbers,
      `${sheet.name} unit numbering`,
    );

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

test("export averages capped percentages per program for quarter and semester sheets", async () => {
  categoryFindManyMock.mock.mockImplementationOnce(async () => [
    {
      id: "category-weighted",
      name: "Kategori Bobot Setara",
      programs: [
        {
          id: "program-target-1",
          tw: 1,
          frequency: 1,
          startDate: new Date("2026-01-01T12:00:00.000Z"),
          endDate: new Date("2026-03-31T12:00:00.000Z"),
        },
        {
          id: "program-target-3",
          tw: 1,
          frequency: 3,
          startDate: new Date("2026-01-01T12:00:00.000Z"),
          endDate: new Date("2026-03-31T12:00:00.000Z"),
        },
      ],
    },
    {
      id: "category-overachievement",
      name: "Kategori Lebih Target",
      programs: [
        {
          id: "program-target-120",
          tw: 2,
          frequency: 1,
          startDate: new Date("2026-04-01T12:00:00.000Z"),
          endDate: new Date("2026-06-30T12:00:00.000Z"),
        },
      ],
    },
  ]);
  queryRawMock.mock.mockImplementationOnce(async () => [
    {
      unitId: "kanwil-2",
      programId: "program-target-1",
      bulan: 1,
      jumlah: 1,
    },
    {
      unitId: "kanwil-2",
      programId: "program-target-120",
      bulan: 4,
      jumlah: 3,
    },
  ]);

  const response = await GET(
    new Request("http://localhost/api/reports/compliance/export?year=2026"),
  );
  assert.equal(response.status, 200);

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
  const tw1 = workbook.getWorksheet("TW I")!;
  const headerValues = tw1.getRow(1).values as unknown[];
  const actualPctColumn = headerValues.indexOf("% REALISASI");
  const averagePctColumn = headerValues.indexOf("% RATA-RATA");
  const targetColumn = headerValues.indexOf("TARGET KINERJA");
  const achievementColumn = headerValues.indexOf("% CAPAIAN KINERJA");

  // TW I: (100% + 0%) / 2 = 50%; approved / aggregate target would be 25%.
  assert.equal(tw1.getCell(3, actualPctColumn).value, 0.5);
  assert.equal(tw1.getCell(3, averagePctColumn).value, 0.5);
  assert.equal(tw1.getCell(3, 4).value, 4);
  assert.equal(tw1.getCell(3, targetColumn).value, 1);
  assert.equal(tw1.getCell(3, achievementColumn).value, 0.5);

  const semester = workbook.getWorksheet("SEMESTER I")!;
  const semesterHeaders = semester.getRow(1).values as unknown[];
  const semesterActualPctColumn = semesterHeaders.indexOf("% REALISASI");
  const semesterAveragePctColumn = semesterHeaders.indexOf("% RATA-RATA");
  const semesterTargetColumn = semesterHeaders.indexOf("TARGET KINERJA");
  const semesterAchievementColumn = semesterHeaders.indexOf(
    "% CAPAIAN KINERJA",
  );
  // Semester I averages [100%, 0%, 120%] = 73.33% after capping each program.
  // Capping only after averaging would yield 120%; aggregate target would yield 100%.
  assert.ok(Math.abs(Number(semester.getCell(3, semesterAveragePctColumn).value) - 220 / 300) < 1e-12);
  assert.equal(semester.getCell(4, semesterActualPctColumn).value, 1.2);
  assert.equal(semester.getCell(3, semesterTargetColumn).value, 1);
  assert.ok(Math.abs(Number(semester.getCell(3, semesterAchievementColumn).value) - 220 / 300) < 1e-12);
});
