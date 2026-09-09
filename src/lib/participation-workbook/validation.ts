import type { Workbook, Worksheet } from "exceljs";

import {
  PARTICIPATION_WORKBOOK_HEADERS,
  PARTICIPATION_WORKBOOK_SHEET_KEYS,
  PARTICIPATION_WORKBOOK_TABLES,
  type ParticipationWorkbookSheetKey,
} from "./constants";
import type {
  WorkbookStructuralIssue,
  WorkbookStructuralValidationResult,
} from "./types";
import { getParticipationTableBoundary } from "./exceljs-adapter";
import { resolveParticipationWorkbookSheetKey } from "./sheet-names";

type DataSheetKey = Exclude<
  ParticipationWorkbookSheetKey,
  "INSTRUCTIONS_REFERENCE"
>;

function getWorksheetsForKey(
  workbook: Workbook,
  key: ParticipationWorkbookSheetKey,
): Worksheet[] {
  return workbook.worksheets.filter(
    (worksheet) => resolveParticipationWorkbookSheetKey(worksheet.name) === key,
  );
}

function getHeaderValues(worksheet: Worksheet): string[] {
  return PARTICIPATION_WORKBOOK_HEADERS.map((_, index) =>
    worksheet
      .getRow(1)
      .getCell(index + 1)
      .text.trim(),
  );
}

function hasExactHeaders(values: readonly string[]): boolean {
  return (
    values.length === PARTICIPATION_WORKBOOK_HEADERS.length &&
    values.every(
      (value, index) => value === PARTICIPATION_WORKBOOK_HEADERS[index],
    )
  );
}

function hasExactTableHeaders(
  worksheet: Worksheet,
  tableName: string,
): boolean {
  const table = worksheet.getTable(tableName);

  if (!table) {
    return false;
  }

  return PARTICIPATION_WORKBOOK_HEADERS.every(
    (header, index) => table.getColumn(index).name === header,
  );
}

function validateDataSheet(
  worksheet: Worksheet,
  key: DataSheetKey,
): WorkbookStructuralIssue[] {
  const issues: WorkbookStructuralIssue[] = [];
  const expectedTableName = PARTICIPATION_WORKBOOK_TABLES[key];
  const headers = getHeaderValues(worksheet);

  if (!hasExactHeaders(headers)) {
    issues.push({
      code: "INVALID_HEADERS",
      sheetName: worksheet.name,
      message: `Header sheet ${worksheet.name} harus persis: ${PARTICIPATION_WORKBOOK_HEADERS.join(", ")}`,
    });
  }

  if (!worksheet.getTable(expectedTableName)) {
    issues.push({
      code: "MISSING_TABLE",
      sheetName: worksheet.name,
      message: `Sheet ${worksheet.name} wajib memiliki tabel Excel ${expectedTableName}`,
    });
  } else if (
    !getParticipationTableBoundary(worksheet, expectedTableName) ||
    !hasExactTableHeaders(worksheet, expectedTableName)
  ) {
    issues.push({
      code: "INVALID_TABLE_HEADERS",
      sheetName: worksheet.name,
      message: `Tabel ${expectedTableName} harus berada pada A1:G... dengan headerRow aktif dan header sesuai kontrak workbook`,
    });
  }

  return issues;
}

export function validateParticipationWorkbookStructure(
  workbook: Workbook,
): WorkbookStructuralValidationResult {
  const issues: WorkbookStructuralIssue[] = [];

  for (const worksheet of workbook.worksheets) {
    if (worksheet.state !== "visible") {
      issues.push({
        code: "HIDDEN_SHEET",
        sheetName: worksheet.name,
        message: `Sheet ${worksheet.name} tidak boleh hidden`,
      });
    }

    if (resolveParticipationWorkbookSheetKey(worksheet.name) === null) {
      issues.push({
        code: "UNEXPECTED_SHEET",
        sheetName: worksheet.name,
        message: `Sheet tambahan ${worksheet.name} tidak diperbolehkan`,
      });
    }
  }

  for (const key of Object.values(PARTICIPATION_WORKBOOK_SHEET_KEYS)) {
    const worksheets = getWorksheetsForKey(workbook, key);

    if (worksheets.length === 0) {
      issues.push({
        code: "MISSING_SHEET",
        message: `Sheet wajib tidak ditemukan untuk key ${key}`,
      });
      continue;
    }

    if (worksheets.length > 1) {
      issues.push({
        code: "DUPLICATE_SHEET_ALIAS",
        sheetName: worksheets.map((worksheet) => worksheet.name).join(", "),
        message: `Alias sheet ${key} muncul lebih dari satu kali`,
      });
    }
  }

  for (const key of [
    PARTICIPATION_WORKBOOK_SHEET_KEYS.SUMMARY,
    PARTICIPATION_WORKBOOK_SHEET_KEYS.KANWIL,
    PARTICIPATION_WORKBOOK_SHEET_KEYS.KANCAB,
    PARTICIPATION_WORKBOOK_SHEET_KEYS.DIVISI,
  ] satisfies readonly DataSheetKey[]) {
    const worksheet = getWorksheetsForKey(workbook, key)[0];

    if (worksheet) {
      issues.push(...validateDataSheet(worksheet, key));
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
