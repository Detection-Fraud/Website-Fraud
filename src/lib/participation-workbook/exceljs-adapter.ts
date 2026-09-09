import ExcelJS, {
  type Row,
  type TableProperties,
  type Workbook,
  type Worksheet,
} from "exceljs";

import {
  PARTICIPATION_WORKBOOK_HEADERS,
  type ParticipationWorkbookHeader,
} from "./constants";

type ParticipationWorkbookBinary = Parameters<
  Workbook["xlsx"]["load"]
>[0];

export function createParticipationWorkbook(): Workbook {
  return new ExcelJS.Workbook();
}

export async function loadParticipationWorkbook(
  buffer: ParticipationWorkbookBinary,
): Promise<Workbook> {
  const workbook = createParticipationWorkbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

export async function writeParticipationWorkbook(
  workbook: Workbook,
){
  return workbook.xlsx.writeBuffer();
}

export const serializeParticipationWorkbook = writeParticipationWorkbook;

export function getCellText(row: Row, columnNumber: number): string {
  return row.getCell(columnNumber).text.trim();
}

export function getOptionalCellNumber(
  row: Row,
  columnNumber: number,
): number | null {
  const text = getCellText(row, columnNumber);

  if (!text) {
    return null;
  }

  const normalized = text.replace(/,/g, "").trim();
  const value = Number(normalized);

  return Number.isFinite(value) ? value : null;
}

export function getOptionalCellInteger(
  row: Row,
  columnNumber: number,
): number | null {
  const value = getOptionalCellNumber(row, columnNumber);

  if (value === null || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

export function isBlankWorkbookRow(row: Row): boolean {
  return PARTICIPATION_WORKBOOK_HEADERS.every(
    (_, index) => getCellText(row, index + 1) === "",
  );
}

export interface ParticipationTableBoundary {
  startColumn: number;
  endColumn: number;
  startRow: number;
  endRow: number;
}

export function getParticipationTableBoundary(
  worksheet: Worksheet,
  tableName: string,
): ParticipationTableBoundary | null {
  const table = worksheet.getTable(tableName);

  if (!table || !table.headerRow) {
    return null;
  }

  const tableWithRuntimeModel = table as typeof table & {
    model?: {
      ref?: unknown;
      tableRef?: unknown;
    };
  };
  const tableRef = [
    tableWithRuntimeModel.ref,
    tableWithRuntimeModel.model?.ref,
    tableWithRuntimeModel.model?.tableRef,
  ].find((value): value is string => typeof value === "string");

  if (!tableRef) {
    return null;
  }

  const match = tableRef.match(
    /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i,
  );

  if (!match) {
    return null;
  }

  const [, startColumnLetters, startRowText, endColumnLetters, endRowText] =
    match;
  const columnNumber = (letters: string) =>
    letters
      .toUpperCase()
      .split("")
      .reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
  const boundary = {
    startColumn: columnNumber(startColumnLetters!),
    endColumn: columnNumber(endColumnLetters!),
    startRow: Number(startRowText),
    endRow: Number(endRowText),
  };

  if (
    boundary.startColumn !== 1 ||
    boundary.endColumn !== PARTICIPATION_WORKBOOK_HEADERS.length ||
    boundary.startRow !== 1 ||
    boundary.endRow < boundary.startRow
  ) {
    return null;
  }

  return boundary;
}

export function addParticipationTable(
  worksheet: Worksheet,
  tableName: string,
  rows: readonly (readonly unknown[])[],
): void {
  const tableProperties: TableProperties = {
    name: tableName,
    displayName: tableName,
    ref: `A1:G${Math.max(rows.length + 1, 1)}`,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showFirstColumn: false,
      showLastColumn: false,
      showRowStripes: true,
      showColumnStripes: false,
    },
    columns: PARTICIPATION_WORKBOOK_HEADERS.map(
      (name: ParticipationWorkbookHeader) => ({
        name,
        filterButton: true,
      }),
    ),
    rows: rows.map((row) => [...row]),
  };

  worksheet.addTable(tableProperties);
}
