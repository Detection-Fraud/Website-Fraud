import type { Row, Workbook } from "exceljs";

import {
  PARTICIPATION_WORKBOOK_HEADERS,
  PARTICIPATION_WORKBOOK_SHEET_KEYS,
  PARTICIPATION_WORKBOOK_TABLES,
  type ParticipationWorkbookSheetKey,
} from "./constants";
import {
  getCellText,
  getParticipationTableBoundary,
  getOptionalCellInteger,
  getOptionalCellNumber,
  isBlankWorkbookRow,
} from "./exceljs-adapter";
import { resolveParticipationWorkbookSheetKey } from "./sheet-names";
import { getUnitCodeCanonicalKey } from "./unit-code";
import type {
  ParsedParticipationWorkbook,
  ParticipationWorkbookRow,
  WorkbookRowParseIssue,
} from "./types";
import { validateParticipationWorkbookStructure } from "./validation";

export class ParticipationWorkbookParseError extends Error {
  constructor(
    message: string,
    public readonly issues: WorkbookRowParseIssue[],
  ) {
    super(message);
    this.name = "ParticipationWorkbookParseError";
  }
}

function requireCellText(
  row: Row,
  rowNumber: number,
  columnNumber: number,
  issues: WorkbookRowParseIssue[],
): string {
  const value = getCellText(row, columnNumber);

  if (!value) {
    issues.push({
      sheetName: row.worksheet.name,
      rowNumber,
      columnName: PARTICIPATION_WORKBOOK_HEADERS[columnNumber - 1],
      message: "Nilai wajib diisi",
    });
  }

  return value;
}

function readOptionalInteger(
  row: Row,
  rowNumber: number,
  columnNumber: number,
  issues: WorkbookRowParseIssue[],
): number | null {
  const text = getCellText(row, columnNumber);

  if (!text) {
    return null;
  }

  const value = getOptionalCellInteger(row, columnNumber);

  if (value === null) {
    issues.push({
      sheetName: row.worksheet.name,
      rowNumber,
      columnName: PARTICIPATION_WORKBOOK_HEADERS[columnNumber - 1],
      message: "Nilai harus berupa bilangan bulat",
    });
  }

  return value;
}

function readOptionalNumber(
  row: Row,
  rowNumber: number,
  columnNumber: number,
  issues: WorkbookRowParseIssue[],
): number | null {
  const text = getCellText(row, columnNumber);

  if (!text) {
    return null;
  }

  const value = getOptionalCellNumber(row, columnNumber);

  if (value === null) {
    issues.push({
      sheetName: row.worksheet.name,
      rowNumber,
      columnName: PARTICIPATION_WORKBOOK_HEADERS[columnNumber - 1],
      message: "Nilai harus berupa angka",
    });
  }

  return value;
}

function parseDataRow(
  row: Row,
  rowNumber: number,
  issues: WorkbookRowParseIssue[],
): ParticipationWorkbookRow | null {
  if (isBlankWorkbookRow(row)) {
    return null;
  }

  const unitCode = requireCellText(row, rowNumber, 2, issues);
  const unitName = getCellText(row, 3);
  const parentUnitName = getCellText(row, 4) || null;
  const headcount = readOptionalInteger(row, rowNumber, 5, issues);
  const participantCount = readOptionalInteger(row, rowNumber, 6, issues);
  const percentage = readOptionalNumber(row, rowNumber, 7, issues);

  return {
    unitCode,
    unitName,
    parentUnitName,
    headcount,
    participantCount,
    percentage,
  };
}

function parseSheet(
  workbook: Workbook,
  sheetKey: Exclude<ParticipationWorkbookSheetKey, "INSTRUCTIONS_REFERENCE">,
  issues: WorkbookRowParseIssue[],
): ParticipationWorkbookRow[] {
  const worksheet = workbook.worksheets.find(
    (candidate) =>
      resolveParticipationWorkbookSheetKey(candidate.name) === sheetKey,
  );

  if (!worksheet) {
    return [];
  }

  const rows: ParticipationWorkbookRow[] = [];

  const canonicalCodes = new Set<string>();
  const table = worksheet.getTable(PARTICIPATION_WORKBOOK_TABLES[sheetKey]);

  if (!table) {
    return rows;
  }

  const boundary = getParticipationTableBoundary(
    worksheet,
    PARTICIPATION_WORKBOOK_TABLES[sheetKey],
  );

  if (!boundary) {
    return rows;
  }

  const firstDataRowNumber = boundary.startRow + 1;
  const lastDataRowNumber =
    boundary.endRow - (table.totalsRow ? 1 : 0);

  for (
    let rowNumber = firstDataRowNumber;
    rowNumber <= lastDataRowNumber;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const tableRow = {
      worksheet: row.worksheet,
      getCell: (columnNumber: number) =>
        row.getCell(boundary.startColumn + columnNumber - 1),
    } as Row;
    const parsed = parseDataRow(tableRow, rowNumber, issues);

    if (parsed) {
      const canonicalCode = getUnitCodeCanonicalKey(parsed.unitCode);

      if (canonicalCodes.has(canonicalCode)) {
        issues.push({
          sheetName: worksheet.name,
          rowNumber,
          columnName: PARTICIPATION_WORKBOOK_HEADERS[1],
          message: `Kode Unit canonical duplikat dalam sheet ${worksheet.name}: ${parsed.unitCode.trim()}`,
        });
      } else {
        canonicalCodes.add(canonicalCode);
      }

      rows.push(parsed);
    }
  }

  return rows;
}

export function parseParticipationWorkbook(
  workbook: Workbook,
): ParsedParticipationWorkbook {
  const structuralValidation = validateParticipationWorkbookStructure(workbook);

  if (!structuralValidation.valid) {
    throw new ParticipationWorkbookParseError(
      "Struktur workbook partisipasi tidak valid",
      structuralValidation.issues.map((issue) => ({
        sheetName: issue.sheetName ?? "",
        rowNumber: 1,
        message: issue.message,
      })),
    );
  }

  const issues: WorkbookRowParseIssue[] = [];

  const sheets = {
    summary: parseSheet(
      workbook,
      PARTICIPATION_WORKBOOK_SHEET_KEYS.SUMMARY,
      issues,
    ),
    kanwil: parseSheet(
      workbook,
      PARTICIPATION_WORKBOOK_SHEET_KEYS.KANWIL,
      issues,
    ),
    kancab: parseSheet(
      workbook,
      PARTICIPATION_WORKBOOK_SHEET_KEYS.KANCAB,
      issues,
    ),
    divisi: parseSheet(
      workbook,
      PARTICIPATION_WORKBOOK_SHEET_KEYS.DIVISI,
      issues,
    ),
  };

  if (issues.length > 0) {
    throw new ParticipationWorkbookParseError(
      "Isi workbook partisipasi tidak valid",
      issues,
    );
  }

  return { sheets };
}
