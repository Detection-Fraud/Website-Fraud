import type { ParticipationWorkbookSheetKey } from "./constants";

export interface ParticipationWorkbookRow {
  unitCode: string;
  unitName: string;
  parentUnitName: string | null;
  headcount: number | null;
  participantCount: number | null;
  percentage: number | null;
}

export interface ParticipationWorkbookRowInput extends ParticipationWorkbookRow {
  no?: number;
}

export interface ParticipationWorkbookSheetRows {
  sheetKey: Exclude<ParticipationWorkbookSheetKey, "INSTRUCTIONS_REFERENCE">;
  rows: ParticipationWorkbookRow[];
}

export interface ParsedParticipationWorkbook {
  sheets: {
    summary: ParticipationWorkbookRow[];
    kanwil: ParticipationWorkbookRow[];
    kancab: ParticipationWorkbookRow[];
    divisi: ParticipationWorkbookRow[];
  };
}

export interface ParticipationWorkbookGeneratorInput {
  summary: readonly ParticipationWorkbookRowInput[];
  kanwil: readonly ParticipationWorkbookRowInput[];
  kancab: readonly ParticipationWorkbookRowInput[];
  divisi: readonly ParticipationWorkbookRowInput[];
  instructions?: readonly string[];
}

export interface WorkbookStructuralIssue {
  code:
    | "MISSING_SHEET"
    | "DUPLICATE_SHEET_ALIAS"
    | "UNEXPECTED_SHEET"
    | "HIDDEN_SHEET"
    | "INVALID_HEADERS"
    | "MISSING_TABLE"
    | "INVALID_TABLE_HEADERS";
  sheetName?: string;
  message: string;
}

export interface WorkbookStructuralValidationResult {
  valid: boolean;
  issues: WorkbookStructuralIssue[];
}

export interface WorkbookRowParseIssue {
  sheetName: string;
  rowNumber: number;
  columnName?: string;
  message: string;
}
