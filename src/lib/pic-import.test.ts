import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import type { PrismaClient } from "@generated/prisma/client";
import { parsePicImportWorkbook, planPicImport, previewPicImport, canApplyPicImportPlan,
  assertPicImportPreviewReceipt, type PicImportEmployeeSnapshot,
  type PicImportAccountSnapshot } from "./pic-import";

const input = [{ rowNumber: 6, nip: "00123", unitName: " kantor   wilayah aceh " }];
function employee(overrides: Partial<PicImportEmployeeSnapshot> = {}): PicImportEmployeeSnapshot {
  return { id: "employee-1", nip: "00123", name: "Candidate", unitId: "unit-1",
    unit: { id: "unit-1", name: "Kantor Wilayah Aceh" }, jenjang: "5", kodeStatpeg: "01",
    statKepeg: "02", isPresentInSource: true, ...overrides };
}
function account(overrides: Partial<PicImportAccountSnapshot> = {}): PicImportAccountSnapshot {
  return { id: "user-1", username: "00123", samlNameId: "00123", employeeId: "employee-1",
    role: "PIC", authProvider: "SSO", unitId: "unit-1", isActive: true, ...overrides };
}
async function workbook(rows: ExcelJS.CellValue[][] = []) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("PIC");
  sheet.getCell("A1").value = "DAFTAR PIC";
  sheet.getRow(5).values = ["NIP", "UNIT_KERJA"];
  sheet.getCell("A6").numFmt = "@";
  for (const [index, values] of rows.entries()) sheet.getRow(index + 6).values = values;
  return wb;
}
async function parse(wb: ExcelJS.Workbook) {
  return parsePicImportWorkbook("PIC.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));
}

describe("PIC Excel import parser", () => {
  it("identifies the cell requiring correction without converting numeric NIP", async () => {
    await assert.rejects(() => workbook([[123, "Unit"]]).then(parse),
      { code: "INVALID_ROW", message: /Baris 6, sel A6: NIP wajib diisi sebagai teks/ });
    await assert.rejects(() => workbook([["00123", ""]]).then(parse),
      { code: "INVALID_ROW", message: /Baris 6, sel B6: UNIT_KERJA wajib diisi sebagai teks/ });
  });
  it("accepts a filled copy of the saved template and preserves text NIP formatting", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await readFile("Template_PIC.xlsx") as never);
    assert.equal(wb.worksheets.length, 1);
    const sheet = wb.getWorksheet("PIC")!;
    assert.equal(sheet.getCell("A6").numFmt, "@");
    for (let row = 6; row <= sheet.rowCount; row++) sheet.getRow(row).values = [];
    sheet.getCell("A6").value = "00123";
    sheet.getCell("B6").value = "Kantor Wilayah Aceh";
    const rows = await parse(wb);
    assert.equal(rows[0].nip, "00123");
    assert.equal(rows[0].rowNumber, 6);
  });
  it("preserves a textual NIP and reads data after the instruction rows", async () => {
    assert.deepEqual(await parse(await workbook([["00123", "Kantor Wilayah Aceh"]])),
      [{ rowNumber: 6, nip: "00123", unitName: "Kantor Wilayah Aceh" }]);
  });
  it("rejects empty, numeric, duplicate, formula, malformed and legacy-layout input", async () => {
    for (const rows of [[], [[123, "Unit"]], [["00123", "Unit"], [" 00123 ", "Unit"]],
      [[{ formula: '"00123"', result: "00123" }, "Unit"]], [["00123", ""]]] as ExcelJS.CellValue[][][]) {
      await assert.rejects(() => workbook(rows).then(parse));
    }
    await assert.rejects(() => parsePicImportWorkbook("PIC.xlsx", Buffer.from("bad bytes")));
    const old = new ExcelJS.Workbook(); old.addWorksheet("PIC").addRow(["NIP", "UNIT_KERJA"]);
    await assert.rejects(() => parse(old));
  });
  it("rejects extra sheets, wrong columns and more than 1000 input rows", async () => {
    const extraSheet = await workbook(); extraSheet.addWorksheet("Other");
    const extraColumn = await workbook(); extraColumn.getWorksheet("PIC")!.getCell("C5").value = "OTHER";
    const wrongHeaders = await workbook(); wrongHeaders.getWorksheet("PIC")!.getCell("A5").value = "UNIT_KERJA";
    const tooMany = await workbook(); tooMany.getWorksheet("PIC")!.getCell("A1006").value = "00123";
    for (const wb of [extraSheet, extraColumn, wrongHeaders, tooMany]) await assert.rejects(() => parse(wb));
  });
});

describe("PIC import planning", () => {
  it("accepts the approved KANWIL and KANCAB equivalents while retaining the Employee unit", () => {
    for (const [excelName, dbName] of [
      ["  kanwil   ACEH ", "KANTOR WILAYAH ACEH"],
      ["KANCAB BANDUNG", "KANTOR CABANG BANDUNG"],
      ["KANTOR WILAYAH ACEH", "KANWIL ACEH"],
      ["KANTOR CABANG BANDUNG", "KANCAB BANDUNG"],
    ]) {
      const plan = planPicImport([{ ...input[0], unitName: excelName }],
        [employee({ unit: { id: "unit-1", name: dbName } })], [],
        [{ id: "unit-1", name: dbName }]);
      assert.equal(plan.canApply, true);
      assert.equal(plan.rows[0].status, "CREATE");
      assert.equal(plan.rows[0].unitId, "unit-1");
    }
    for (const [excelName, dbName] of [
      ["KANWIL ACEH", "KANTOR WILAYAH RIAU"],
      ["KANCAB BANDUNG", "KANTOR CABANG GARUT"],
      ["KANWIL BANDUNG", "KANTOR CABANG BANDUNG"],
      ["KANWILACEH", "KANTOR WILAYAH ACEH"],
      ["KANCABBANDUNG", "KANTOR CABANG BANDUNG"],
      ["DIVISI MANAJEMEN MUTU", "DIVISI PENGADAAN NON BERAS"],
    ]) {
      const plan = planPicImport([{ ...input[0], unitName: excelName }],
        [employee({ unit: { id: "unit-1", name: dbName } })], [],
        [{ id: "unit-1", name: dbName }, { id: "other", name: excelName }]);
      assert.equal(plan.canApply, false);
      assert.equal(plan.rows[0].reason, "UNIT_MISMATCH");
    }
  });
  it("creates only an eligible Employee with a normalized matching unit", () => {
    const plan = planPicImport(input, [employee()], []);
    assert.equal(plan.canApply, true); assert.equal(plan.rows[0].status, "CREATE");
    assert.equal(plan.rows[0].unitId, "unit-1");
  });
  it("accepts reviewed aliases without changing the Employee unit or guessing other names", () => {
    for (const [excelName, dbName] of [
      [" SEKRETARIAT   PERUSAHAAN ", "SEKRETARIS PERUSAHAAN"],
      ["SEKRETARIS PERUSAHAAN", "SEKRETARIAT PERUSAHAAN"],
      ["PMO INFRASTRUKTUR PASCAPANEN", "PROJECT MANAGEMENT OFFICE INFRASTRUKTUR PASCAPANEN"],
      ["KANCAB TANGGERANG", "KANTOR CABANG TANGERANG"],
      ["KANCAV LANGGUR", "KANTOR CABANG LANGGUR"],
    ]) {
      const plan = planPicImport([{ ...input[0], unitName: excelName }],
        [employee({ unit: { id: "unit-1", name: dbName } })], [],
        [{ id: "other", name: excelName }, { id: "unit-1", name: dbName }]);
      assert.equal(plan.rows[0].status, "CREATE");
      assert.equal(plan.rows[0].unitId, "unit-1");
    }
    for (const [excelName, dbName] of [
      ["KANCAV BOGOR", "KANTOR CABANG BOGOR"],
      ["PMO INFRASTRUKTUR PASCAPANEN", "PROJECT MANAGEMENT OFFICE TRANSFORMASI"],
      ["SEKRETARIAT PERUSAHAAN", "DIVISI MANAJEMEN MUTU"],
    ]) {
      assert.equal(planPicImport([{ ...input[0], unitName: excelName }],
        [employee({ unit: { id: "unit-1", name: dbName } })], []).canApply, false);
    }
  });
  it("distinguishes a different known unit from an unreviewed or ambiguous unit name", () => {
    const records = [employee({ unit: { id: "unit-1", name: "DIVISI PENGADAAN NON BERAS" } })];
    const row = [{ ...input[0], unitName: "DIVISI MANAJEMEN MUTU" }];
    const different = planPicImport(row, records, [], [{ id: "unit-2", name: row[0].unitName }]);
    assert.equal(different.rows[0].reason, "UNIT_MISMATCH");
    assert.equal(different.rows[0].status, "ERROR");
    const unknown = planPicImport(row, records, []);
    assert.equal(unknown.rows[0].reason, "UNIT_NAME_REQUIRES_REVIEW");
    assert.equal(unknown.rows[0].status, "REVIEW");
    const ambiguous = planPicImport(row, records, [],
      [{ id: "unit-2", name: row[0].unitName }, { id: "unit-3", name: row[0].unitName }]);
    assert.equal(ambiguous.rows[0].reason, "UNIT_NAME_AMBIGUOUS");
    assert.equal(ambiguous.canApply, false);
    const changed = planPicImport(row, records, [], [{ id: "unit-1", name: row[0].unitName }]);
    assert.equal(changed.rows[0].reason, "UNIT_DATA_CHANGED");
    assert.equal(changed.canApply, false);
    const unavailable = planPicImport(row, [employee({ unitId: null, unit: null })], []);
    assert.equal(unavailable.rows[0].reason, "EMPLOYEE_UNIT_UNAVAILABLE");
    const equivalent = planPicImport([{ ...input[0], unitName: "DIVISI RISIKO DAN KEPATUHAN" }],
      [employee({ unit: { id: "unit-1", name: "DIVISI RISIKO & KEPATUHAN" } })], []);
    assert.equal(equivalent.canApply, true);
  });
  it("accepts all twelve reviewed unit pairs in either direction without broadening other aliases", () => {
    const pairs = [
      ["UB JASTASMA", "UB-JASTASMA"],
      ["UB-SENTRA NIAGA", "UB-BULOG SENTRA   NIAGA"],
      ["KANCAB BLANGPIDIE", "KANTOR CABANG BLANG PIDIE"],
      ["KANWIL JAKARTA   DAN BANTEN", "KANTOR WILAYAH   DKI JAKARTA DAN BANTEN"],
      ["KACAB BOGOR", "KANTOR CABANG   BOGOR"],
      ["KANCAB PUTUSIBAU", "KANTOR CABANG PUTUSSIBAU"],
      ["KANCAB LUWUK", "KANTOR CABANG   LUWUK BANGGAI"],
      ["KANCAB TOLITOLI", "KANTOR CABANG TOLI-TOLI"],
      ["KANCAB POLEWALI MANDAR", "KANTOR CABANG POLMAN"],
      ["KANWIL PAPUA   DAN PABAR", "KANTOR WILAYAH   PAPUA"],
      ["KANCAB FAK-FAK", "KANTOR CABANG   FAK FAK"],
      ["KANCAB TEMBINABUAN", "KANTOR CABANG TEMINABUAN"],
    ];
    for (const [left, right] of pairs) {
      for (const [excelName, dbName] of [[left, right], [right, left]]) {
        const records = [employee({ unit: { id: "unit-1", name: dbName } })];
        const row = [{ ...input[0], unitName: ` ${excelName.toLowerCase()} ` }];
        const units = [{ id: "other", name: excelName }, { id: "unit-1", name: dbName }];
        const plan = planPicImport(row, records, [], units);
        assert.equal(plan.rows[0].status, "CREATE");
        assert.equal(plan.rows[0].unitId, "unit-1");
        assert.equal(planPicImport(row, records, [account()], units).rows[0].status, "ALREADY_ASSIGNED");
      }
    }
    for (const [excelName, dbName] of [
      ["KACAB BANDUNG", "KANTOR CABANG BANDUNG"],
      ["KANCAB LUWUK", "KANTOR CABANG POSO"],
      ["KANWIL PAPUA DAN PABAR", "KANTOR WILAYAH PAPUA BARAT"],
      ["UB-SENTRA NIAGA TIMUR", "UB-BULOG SENTRA NIAGA TIMUR"],
    ]) {
      const plan = planPicImport([{ ...input[0], unitName: excelName }],
        [employee({ unit: { id: "unit-1", name: dbName } })], [],
        [{ id: "other", name: excelName }, { id: "unit-1", name: dbName }]);
      assert.equal(plan.rows[0].reason, "UNIT_MISMATCH");
    }
  });
  it("skips an existing active and exactly linked SSO PIC", () => {
    assert.equal(planPicImport(input, [employee()], [account()]).rows[0].status, "ALREADY_ASSIGNED");
  });
  it("accepts Jenjang V (source code 6) for a new PIC", () => {
    assert.equal(planPicImport(input, [employee({ jenjang: "6" })], []).rows[0].status, "CREATE");
  });
  it("rejects missing, ineligible, wrong-unit and duplicate Employee input", () => {
    for (const records of [[], [employee({ jenjang: "4" })], [employee({ isPresentInSource: false })],
      [employee({ kodeStatpeg: "03" })], [employee({ statKepeg: "01" })], [employee({ unitId: null, unit: null })],
      [employee({ unit: { id: "unit-1", name: "Different unit" } })]]) {
      assert.equal(planPicImport(input, records, []).canApply, false);
    }
    assert.equal(planPicImport([...input, ...input], [employee()], []).rows[1].reason, "DUPLICATE_NIP");
  });
  it("requires review for VIEWER, inactive, LOCAL, ADMIN, unlinked or conflicting accounts", () => {
    for (const overrides of [{ role: "VIEWER" }, { isActive: false }, { authProvider: "LOCAL" },
      { role: "ADMIN" }, { employeeId: null }, { unitId: "different" }, { username: "different" }] as Partial<PicImportAccountSnapshot>[]) {
      const plan = planPicImport(input, [employee()], [account(overrides)]);
      assert.equal(plan.canApply, false); assert.equal(plan.rows[0].status, "REVIEW");
    }
    assert.equal(planPicImport(input, [employee()], [account(), account({ id: "conflict" })]).canApply, false);
  });
  it("previews using read-only queries without opening a transaction", async () => {
    const db = { employee: { findMany: async () => [employee()] }, user: { findMany: async () => [] },
      unit: { findMany: async () => [employee().unit] },
      $transaction: () => { throw new Error("preview must not write"); } } as unknown as PrismaClient;
    assert.equal((await previewPicImport(input, db)).counts.CREATE, 1);
  });
  it("requires explicit partial mode and binds the preview to mode, file, target and every row", () => {
    const rows = [...input, { rowNumber: 7, nip: "missing", unitName: "Unknown" }];
    const plan = planPicImport(rows, [employee()], []);
    assert.equal(canApplyPicImportPlan(plan), false);
    assert.equal(canApplyPicImportPlan(plan, true), true);
    assert.equal(canApplyPicImportPlan(planPicImport(rows, [], []), true), false);
    assert.equal(canApplyPicImportPlan(planPicImport([...input, ...input], [employee()], []), true), false);
    const confirmation = { fileSha256: "file-hash", targetFingerprint: "target-hash", skipInvalid: true };
    const receipt = { version: 2, ...confirmation, canApply: true, rows: plan.rows };
    assert.doesNotThrow(() => assertPicImportPreviewReceipt(receipt, confirmation, plan));
    for (const changed of [null, [], { ...receipt, version: 1 }, { ...receipt, skipInvalid: false },
      { ...receipt, fileSha256: "different" }, { ...receipt, targetFingerprint: "different" },
      { ...receipt, canApply: false }, { ...receipt, rows: plan.rows.slice(0, 1) }]) {
      assert.throws(() => assertPicImportPreviewReceipt(changed, confirmation, plan));
    }
    assert.throws(() => assertPicImportPreviewReceipt(receipt, { ...confirmation, skipInvalid: false }, plan));
    const clean = planPicImport(input, [employee()], []);
    assert.doesNotThrow(() => assertPicImportPreviewReceipt(
      { ...receipt, skipInvalid: false, rows: clean.rows }, { ...confirmation, skipInvalid: false }, clean));
  });
});
