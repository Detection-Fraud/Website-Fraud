import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PARTICIPATION_WORKBOOK_INSTRUCTIONS,
  PARTICIPATION_WORKBOOK_HEADERS,
  PARTICIPATION_WORKBOOK_SHEETS,
  PARTICIPATION_WORKBOOK_TABLES,
  getCanonicalUnitCode,
  generateParticipationWorkbook,
  loadParticipationWorkbook,
  parseParticipationWorkbook,
  ParticipationWorkbookParseError,
  serializeParticipationWorkbook,
  validateParticipationWorkbookStructure,
} from "./participation-workbook";

describe("participation workbook guidance", () => {
  it("guides admins to enter participant counts and treats percentage as preview output", () => {
    assert.ok(
      PARTICIPATION_WORKBOOK_INSTRUCTIONS.some((instruction) =>
        instruction.includes("Jumlah Partisipasi sebagai jumlah peserta"),
      ),
    );
    assert.ok(
      PARTICIPATION_WORKBOOK_INSTRUCTIONS.some((instruction) =>
        instruction.includes("preview hasil perhitungan"),
      ),
    );
  });
});

async function roundTrip(workbook: Parameters<typeof parseParticipationWorkbook>[0]) {
  return loadParticipationWorkbook(await serializeParticipationWorkbook(workbook));
}

describe("participation workbook 09A primitives", () => {
  it("uses kodeOrg as the canonical unit code", () => {
    assert.equal(getCanonicalUnitCode({ kodeOrg: "  UNIT-001  " }), "UNIT-001");
  });

  it("generates a structurally valid workbook and parses it back", async () => {
    const workbook = generateParticipationWorkbook({
      summary: [
        {
          unitCode: "UNIT-001",
          unitName: "Unit Satu",
          parentUnitName: "Kanwil Satu",
          headcount: 10,
          participantCount: 7,
          percentage: 70,
        },
      ],
      kanwil: [
        {
          unitCode: "UNIT-001",
          unitName: "Kanwil Satu",
          parentUnitName: null,
          headcount: 10,
          participantCount: 7,
          percentage: 70,
        },
      ],
      kancab: [],
      divisi: [],
    });

    assert.deepEqual(
      workbook.worksheets.map((worksheet) => worksheet.name),
      [
        PARTICIPATION_WORKBOOK_SHEETS.SUMMARY,
        PARTICIPATION_WORKBOOK_SHEETS.KANWIL,
        PARTICIPATION_WORKBOOK_SHEETS.KANCAB,
        PARTICIPATION_WORKBOOK_SHEETS.DIVISI,
        PARTICIPATION_WORKBOOK_SHEETS.INSTRUCTIONS_REFERENCE,
      ],
    );

    const firstWorksheet = workbook.worksheets[0];
    assert.ok(firstWorksheet);

    const headerValues = PARTICIPATION_WORKBOOK_HEADERS.map((_, index) =>
      firstWorksheet.getRow(1).getCell(index + 1).text,
    );

    assert.deepEqual(headerValues, [...PARTICIPATION_WORKBOOK_HEADERS]);

    const structuralValidation =
      validateParticipationWorkbookStructure(workbook);

    assert.equal(structuralValidation.valid, true);
    assert.deepEqual(structuralValidation.issues, []);

    const buffer = await serializeParticipationWorkbook(workbook);
    const loaded = await loadParticipationWorkbook(buffer);
    const loadedTable = loaded
      .getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.SUMMARY)!
      .getTable(PARTICIPATION_WORKBOOK_TABLES.SUMMARY)!;
    assert.equal(
      (loadedTable as typeof loadedTable & { rows?: unknown }).rows,
      undefined,
    );
    const parsed = parseParticipationWorkbook(loaded);

    assert.equal(parsed.sheets.summary.length, 1);
    assert.equal(parsed.sheets.summary[0].unitCode, "UNIT-001");
    assert.equal(parsed.sheets.summary[0].participantCount, 7);
    assert.equal(parsed.sheets.summary[0].percentage, 70);
  });

  it("excludes a table totals row from parsed data", async () => {
    const workbook = generateParticipationWorkbook({
      summary: [
        {
          unitCode: "UNIT-001",
          unitName: "Unit Satu",
          parentUnitName: null,
          headcount: 10,
          participantCount: 7,
          percentage: 70,
        },
      ],
      kanwil: [],
      kancab: [],
      divisi: [],
    });
    const worksheet = workbook.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.SUMMARY)!;
    const table = worksheet.getTable(PARTICIPATION_WORKBOOK_TABLES.SUMMARY)!;
    table.totalsRow = true;
    table.ref = "A1:G3";
    worksheet.getRow(3).getCell(1).value = "Total";
    table.commit();

    const parsed = parseParticipationWorkbook(
      await loadParticipationWorkbook(await serializeParticipationWorkbook(workbook)),
    );

    assert.deepEqual(parsed.sheets.summary.map((row) => row.unitCode), [
      "UNIT-001",
    ]);
  });

  it("parses a generated canonical workbook after ExcelJS moves the range to model.tableRef", async () => {
    const workbook = generateParticipationWorkbook({
      summary: [{ unitCode: "UNIT-001", unitName: "Unit Satu", parentUnitName: null, headcount: 10, participantCount: 7, percentage: 70 }],
      kanwil: [],
      kancab: [],
      divisi: [],
    });
    const table = workbook.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.SUMMARY)!.getTable(PARTICIPATION_WORKBOOK_TABLES.SUMMARY)!;
    table.ref = undefined as never;

    const parsed = parseParticipationWorkbook(workbook);

    assert.equal(parsed.sheets.summary[0]?.unitCode, "UNIT-001");
  });

  it("fails closed when a named table has missing or malformed range metadata", () => {
    for (const tableRef of [undefined, "not-a-range"]) {
      const workbook = generateParticipationWorkbook({ summary: [], kanwil: [], kancab: [], divisi: [] });
      const table = workbook.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.SUMMARY)!.getTable(PARTICIPATION_WORKBOOK_TABLES.SUMMARY)!;
      table.ref = tableRef as never;
      (table as typeof table & { model: { tableRef?: unknown } }).model.tableRef = tableRef;

      assert.doesNotThrow(() => validateParticipationWorkbookStructure(workbook));
      assert.equal(validateParticipationWorkbookStructure(workbook).valid, false);
      assert.throws(
        () => parseParticipationWorkbook(workbook),
        (error: ParticipationWorkbookParseError) => error.name === "ParticipationWorkbookParseError",
      );
    }
  });

  it("rejects a workbook with missing required sheets", () => {
    const workbook = generateParticipationWorkbook({
      summary: [],
      kanwil: [],
      kancab: [],
      divisi: [],
    });

    workbook.removeWorksheet(
      workbook.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.KANWIL)!.id,
    );

    const validation = validateParticipationWorkbookStructure(workbook);

    assert.equal(validation.valid, false);
    assert.equal(
      validation.issues.some((issue) => issue.code === "MISSING_SHEET"),
      true,
    );
  });

  it("preserves exact tables, authoritative fields, and row order after round-trip", async () => {
    const workbook = generateParticipationWorkbook({
      summary: [
        { no: 2, unitCode: "U-002", unitName: "Unit Dua", parentUnitName: "Kanwil Dua", headcount: 125, participantCount: 80, percentage: 64 },
        { no: 1, unitCode: "U-001", unitName: "Unit Satu", parentUnitName: null, headcount: 10, participantCount: 3, percentage: 30 },
      ],
      kanwil: [], kancab: [], divisi: [],
    });

    for (const [sheetName, tableName] of [
      [PARTICIPATION_WORKBOOK_SHEETS.SUMMARY, "SummaryTable"],
      [PARTICIPATION_WORKBOOK_SHEETS.KANWIL, "KanwilTable"],
      [PARTICIPATION_WORKBOOK_SHEETS.KANCAB, "KancabTable"],
      [PARTICIPATION_WORKBOOK_SHEETS.DIVISI, "DivisiTable"],
    ] as const) {
      const worksheet = workbook.getWorksheet(sheetName);
      assert.ok(worksheet);
      const table = worksheet.getTable(tableName);
      assert.ok(table);
      assert.deepEqual(
        PARTICIPATION_WORKBOOK_HEADERS.map((_, index) => table.getColumn(index).name),
        [...PARTICIPATION_WORKBOOK_HEADERS],
      );
    }

    const loaded = await loadParticipationWorkbook(await serializeParticipationWorkbook(workbook));
    const parsed = parseParticipationWorkbook(loaded);
    assert.deepEqual(parsed.sheets.summary, [
      { unitCode: "U-002", unitName: "Unit Dua", parentUnitName: "Kanwil Dua", headcount: 125, participantCount: 80, percentage: 64 },
      { unitCode: "U-001", unitName: "Unit Satu", parentUnitName: null, headcount: 10, participantCount: 3, percentage: 30 },
    ]);
  });

  it("parses only rows inside each expected table and ignores outside rows", async () => {
    const workbook = generateParticipationWorkbook({
      summary: [{ unitCode: "IN-TABLE", unitName: "Inside", parentUnitName: null, headcount: 1, participantCount: 1, percentage: 100 }],
      kanwil: [], kancab: [], divisi: [],
    });
    const worksheet = workbook.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.SUMMARY)!;
    worksheet.addRow([99, "OUTSIDE", "Outside", null, 9, 9, 100]);
    worksheet.addRow([100, "BELOW", "Below", null, 9, 9, 100]);

    const parsed = parseParticipationWorkbook(await roundTrip(workbook));
    assert.deepEqual(parsed.sheets.summary.map((row) => row.unitCode), ["IN-TABLE"]);
  });

  it("rejects canonical duplicate Kode Unit within every logical data sheet", async () => {
    for (const [sheetName, key] of [
      [PARTICIPATION_WORKBOOK_SHEETS.SUMMARY, "SUMMARY"],
      [PARTICIPATION_WORKBOOK_SHEETS.KANWIL, "KANWIL"],
      [PARTICIPATION_WORKBOOK_SHEETS.KANCAB, "KANCAB"],
      [PARTICIPATION_WORKBOOK_SHEETS.DIVISI, "DIVISI"],
    ] as const) {
      const workbook = generateParticipationWorkbook({ summary: [], kanwil: [], kancab: [], divisi: [] });
      const worksheet = workbook.getWorksheet(sheetName)!;
      const table = worksheet.getTable(PARTICIPATION_WORKBOOK_TABLES[key]);
      table.addRow([1, " Unit-001 ", "First", null, 1, 1, 100]);
      table.addRow([2, "unit-001", "Second", null, 1, 1, 100]);
      table.commit();

      await assert.rejects(
        async () => parseParticipationWorkbook(await roundTrip(workbook)),
        (error: ParticipationWorkbookParseError) =>
          error.name === "ParticipationWorkbookParseError" &&
          error.issues.some((issue) => issue.sheetName === sheetName && issue.message.includes("canonical duplikat")),
      );
    }
  });

  it("parses the same logical workbook after worksheets are reordered", async () => {
    const workbook = generateParticipationWorkbook({
      summary: [{ unitCode: "U-001", unitName: "Unit Satu", parentUnitName: null, headcount: 10, participantCount: 3, percentage: 30 }],
      kanwil: [], kancab: [], divisi: [],
    });
    const reorderedNames = [
      PARTICIPATION_WORKBOOK_SHEETS.INSTRUCTIONS_REFERENCE,
      PARTICIPATION_WORKBOOK_SHEETS.DIVISI,
      PARTICIPATION_WORKBOOK_SHEETS.SUMMARY,
      PARTICIPATION_WORKBOOK_SHEETS.KANCAB,
      PARTICIPATION_WORKBOOK_SHEETS.KANWIL,
    ];
    const reorderedIndex = new Map<string, number>();
    reorderedNames.forEach((name, index) => {
      reorderedIndex.set(name, index);
    });

    for (const worksheet of workbook.worksheets) {
      (
        worksheet as typeof worksheet & {
          orderNo: number;
        }
      ).orderNo = reorderedIndex.get(worksheet.name)!;
    }

    const serialized = await serializeParticipationWorkbook(workbook);
    const loaded = await loadParticipationWorkbook(serialized);
    const parsed = parseParticipationWorkbook(loaded);
    assert.deepEqual(loaded.worksheets.map((worksheet) => worksheet.name), reorderedNames);
    assert.equal(parsed.sheets.summary[0]?.unitCode, "U-001");
  });

  it("accepts locked Summary and Instructions/Reference aliases", () => {
    const workbook = generateParticipationWorkbook({ summary: [], kanwil: [], kancab: [], divisi: [] });
    workbook.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.SUMMARY)!.name = "Ringkasan";
    workbook.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.INSTRUCTIONS_REFERENCE)!.name = "Petunjuk-Referensi";
    const validation = validateParticipationWorkbookStructure(workbook);
    assert.equal(validation.valid, true);
    assert.deepEqual(validation.issues, []);
  });

  it("rejects duplicate aliases, invalid headers, and missing tables", () => {
    const duplicate = generateParticipationWorkbook({ summary: [], kanwil: [], kancab: [], divisi: [] });
    duplicate.addWorksheet("Ringkasan");
    assert.equal(validateParticipationWorkbookStructure(duplicate).valid, false);
    assert.ok(validateParticipationWorkbookStructure(duplicate).issues.some((issue) => issue.code === "DUPLICATE_SHEET_ALIAS"));

    const invalidHeaders = generateParticipationWorkbook({ summary: [], kanwil: [], kancab: [], divisi: [] });
    invalidHeaders.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.SUMMARY)!.getRow(1).getCell(2).value = "Unit Name";
    assert.ok(validateParticipationWorkbookStructure(invalidHeaders).issues.some((issue) => issue.code === "INVALID_HEADERS"));

    const missingTable = generateParticipationWorkbook({ summary: [], kanwil: [], kancab: [], divisi: [] });
    missingTable.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.SUMMARY)!.removeTable("SummaryTable");
    assert.ok(validateParticipationWorkbookStructure(missingTable).issues.some((issue) => issue.code === "MISSING_TABLE"));
  });

  it("rejects extra worksheets with the structured issue contract", () => {
    const workbook = generateParticipationWorkbook({
      summary: [],
      kanwil: [],
      kancab: [],
      divisi: [],
    });
    workbook.addWorksheet("Unexpected");

    const validation = validateParticipationWorkbookStructure(workbook);
    const issue = validation.issues.find(
      (candidate) => candidate.sheetName === "Unexpected",
    );

    assert.equal(validation.valid, false);
    assert.ok(issue);
    assert.equal(issue.code, "UNEXPECTED_SHEET");
    assert.equal(issue.sheetName, "Unexpected");
  });

  it("INTENTIONAL RED — rejects hidden worksheets", () => {
    const workbook = generateParticipationWorkbook({ summary: [], kanwil: [], kancab: [], divisi: [] });
    workbook.getWorksheet(PARTICIPATION_WORKBOOK_SHEETS.KANWIL)!.state = "hidden";
    const validation = validateParticipationWorkbookStructure(workbook);
    assert.equal(validation.valid, false);
    assert.ok(validation.issues.some((issue) => issue.message.toLowerCase().includes("hidden")));
  });

});
