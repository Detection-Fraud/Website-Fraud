import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import type { CellValue } from "exceljs";
import { createEmployeeImportTemplate, EMPLOYEE_EXCEL_HEADERS, EMPLOYEE_IMPORT_MAX_ROWS, parseEmployeeXlsx, validateEmployeeWorksheetRowBounds } from "@/lib/employee-excel-import";
import { PENTAHO_EMPLOYEE_HEADERS } from "@/lib/pentaho-employee-adapter";

function workbookBuffer(
  configure: (workbook: ExcelJS.Workbook) => void,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  configure(workbook);
  return workbook.xlsx.writeBuffer();
}

function validWorkbook(overrides: Record<string, CellValue> = {}) {
  return workbookBuffer((workbook) => {
    const sheet = workbook.addWorksheet("Karyawan");
    sheet.addRow([...EMPLOYEE_EXCEL_HEADERS]);
    const row: Record<string, CellValue> = {
      NIP: "001234", NAMA: "Nama Pegawai", JAB_LKP: "Jabatan",
      KODE_STATPEG: "01", STAT_KEPEG: "02", KODE_DOLOG: "00",
      KODE_SUBDOLOG: "00", KODE_KANSILOG: "00", KODE_GUDANG: "000000",
      KODE_ORG: "E00000", JENJANG: "4. Jenjang III", NAMA_ORG: "Perum Bulog",
      NAMA_SATKER: "Kantor Pusat", NAMA_INDUK: "",
      ...overrides,
    };
    sheet.addRow(EMPLOYEE_EXCEL_HEADERS.map((header) => row[header]));
  });
}

describe("Employee Excel snapshot parser", () => {
  it("rejects worksheet row counts above 100,000 data rows during preflight", () => {
    const allowed = `<worksheet><sheetData><row r="1"/>${"<row/>".repeat(EMPLOYEE_IMPORT_MAX_ROWS)}</sheetData></worksheet>`;
    const overLimit = `<worksheet><sheetData><row r="1"/>${"<row/>".repeat(EMPLOYEE_IMPORT_MAX_ROWS + 1)}</sheetData></worksheet>`;
    assert.doesNotThrow(() => validateEmployeeWorksheetRowBounds(allowed));
    assert.throws(() => validateEmployeeWorksheetRowBounds(overLimit), { code: "INVALID_WORKBOOK" });
  });

  it("generates exactly one empty Karyawan sheet with the ordered 14-field header", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createEmployeeImportTemplate() as never);
    assert.equal(workbook.worksheets.length, 1);
    assert.equal(workbook.worksheets[0]?.name, "Karyawan");
    assert.deepEqual((workbook.worksheets[0]?.getRow(1).values as unknown[] | undefined)?.slice(1), [...EMPLOYEE_EXCEL_HEADERS]);
    assert.equal(workbook.worksheets[0]?.rowCount, 1);
  });

  it("accepts a valid .xlsx and normalizes the complete snapshot", async () => {
    const snapshot = await parseEmployeeXlsx("employees.xlsx", Buffer.from(await validWorkbook()));
    assert.equal(snapshot.sourceSystem, "PENTAHO");
    assert.equal(snapshot.employees.length, 1);
    assert.equal(snapshot.employees[0]?.nip, "001234");
    assert.equal(snapshot.employees[0]?.jenjang, "4");
  });

  it("rejects non-xlsx extensions and malformed zip bytes", async () => {
    await assert.rejects(parseEmployeeXlsx("employees.csv", Buffer.from("bad")), { code: "INVALID_FILE" });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from("bad")), { code: "INVALID_FILE" });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.alloc(22)), { code: "INVALID_WORKBOOK" });
  });

  it("rejects an over-limit file before attempting workbook parsing", async () => {
    const oversized = Buffer.alloc(25 * 1024 * 1024 + 1);
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", oversized), { code: "FILE_TOO_LARGE" });
  });

  it("rejects legacy or reordered headers", async () => {
    const bytes = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Karyawan");
      sheet.addRow([...EMPLOYEE_EXCEL_HEADERS].reverse());
      sheet.addRow(Array.from({ length: EMPLOYEE_EXCEL_HEADERS.length }, () => "x"));
    });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from(bytes)), { code: "INVALID_WORKBOOK" });
  });

  it("rejects the former 18-column workbook and any extra column", async () => {
    const oldContract = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Karyawan");
      sheet.addRow([...PENTAHO_EMPLOYEE_HEADERS]);
      sheet.addRow(Array.from({ length: PENTAHO_EMPLOYEE_HEADERS.length }, () => "x"));
    });
    const extraColumn = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Karyawan");
      sheet.addRow([...EMPLOYEE_EXCEL_HEADERS, "ADMIN_ACTOR"]);
      sheet.addRow(Array.from({ length: EMPLOYEE_EXCEL_HEADERS.length + 1 }, () => "x"));
    });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from(oldContract)), { code: "INVALID_WORKBOOK" });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from(extraColumn)), { code: "INVALID_WORKBOOK" });
  });

  it("rejects extra sheets, formula cells, and object-valued cells", async () => {
    const extraSheet = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Karyawan");
      sheet.addRow([...EMPLOYEE_EXCEL_HEADERS]);
      sheet.addRow(Array.from({ length: EMPLOYEE_EXCEL_HEADERS.length }, () => "x"));
      workbook.addWorksheet("Panduan");
    });
    const formula = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Karyawan");
      sheet.addRow([...EMPLOYEE_EXCEL_HEADERS]);
      const formulaRow = Array.from({ length: EMPLOYEE_EXCEL_HEADERS.length }, () => "x");
      formulaRow[0] = { formula: "1+1" } as never;
      sheet.addRow(formulaRow);
    });
    const richText = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Karyawan");
      sheet.addRow([...EMPLOYEE_EXCEL_HEADERS]);
      const richTextRow = Array.from({ length: EMPLOYEE_EXCEL_HEADERS.length }, () => "x");
      richTextRow[0] = { richText: [{ text: "001" }] } as never;
      sheet.addRow(richTextRow);
    });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from(extraSheet)), { code: "INVALID_WORKBOOK" });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from(formula)), { code: "INVALID_WORKBOOK" });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from(richText)), { code: "INVALID_WORKBOOK" });
  });

  it("rejects duplicate NIP and non-string required values", async () => {
    const duplicate = await validWorkbook();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(duplicate as never);
    const existingValues = workbook.worksheets[0]?.getRow(2).values as unknown[] | undefined;
    workbook.worksheets[0]?.addRow(existingValues?.slice(1) ?? []);
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from(await workbook.xlsx.writeBuffer())), { code: "INVALID_SNAPSHOT" });
    await assert.rejects(parseEmployeeXlsx("employees.xlsx", Buffer.from(await validWorkbook({ NIP: 1234 }))), { code: "INVALID_SNAPSHOT" });
  });
});
