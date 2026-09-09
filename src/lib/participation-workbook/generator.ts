import type { Workbook, Worksheet } from "exceljs";

import {
  PARTICIPATION_WORKBOOK_INSTRUCTIONS,
  PARTICIPATION_WORKBOOK_SHEETS,
  PARTICIPATION_WORKBOOK_TABLES,
} from "./constants";
import {
  addParticipationTable,
  createParticipationWorkbook,
} from "./exceljs-adapter";
import type {
  ParticipationWorkbookGeneratorInput,
  ParticipationWorkbookRowInput,
} from "./types";

function toExcelRow(
  row: ParticipationWorkbookRowInput,
  index: number,
): (string | number | null)[] {
  return [
    row.no ?? index + 1,
    row.unitCode,
    row.unitName,
    row.parentUnitName,
    row.headcount,
    row.participantCount,
    row.percentage,
  ];
}

function configureDataWorksheet(worksheet: Worksheet): void {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: "A1",
    to: "G1",
  };

  worksheet.getColumn(1).width = 8;
  worksheet.getColumn(2).width = 20;
  worksheet.getColumn(3).width = 34;
  worksheet.getColumn(4).width = 34;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 22;
  worksheet.getColumn(7).width = 16;

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.getColumn(5).numFmt = "0";
  worksheet.getColumn(6).numFmt = "0";
  worksheet.getColumn(7).numFmt = "0.00";
}

function addDataWorksheet(
  workbook: Workbook,
  sheetName: string,
  tableName: string,
  rows: readonly ParticipationWorkbookRowInput[],
): void {
  const worksheet = workbook.addWorksheet(sheetName);
  const excelRows = rows.map(toExcelRow);

  addParticipationTable(worksheet, tableName, excelRows);
  configureDataWorksheet(worksheet);
}

function addInstructionsWorksheet(
  workbook: Workbook,
  instructions: readonly string[],
): void {
  const worksheet = workbook.addWorksheet(
    PARTICIPATION_WORKBOOK_SHEETS.INSTRUCTIONS_REFERENCE,
  );

  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getColumn(1).width = 110;

  instructions.forEach((instruction, index) => {
    const row = worksheet.addRow([instruction]);
    row.font = { bold: index === 0 };
    row.alignment = {
      vertical: "top",
      wrapText: true,
    };
  });
}

export function generateParticipationWorkbook(
  input: ParticipationWorkbookGeneratorInput,
): Workbook {
  const workbook = createParticipationWorkbook();

  workbook.creator = "Fraud Detection BULOG";
  workbook.lastModifiedBy = "Fraud Detection BULOG";
  workbook.created = new Date();
  workbook.modified = new Date();

  addDataWorksheet(
    workbook,
    PARTICIPATION_WORKBOOK_SHEETS.SUMMARY,
    PARTICIPATION_WORKBOOK_TABLES.SUMMARY,
    input.summary,
  );

  addDataWorksheet(
    workbook,
    PARTICIPATION_WORKBOOK_SHEETS.KANWIL,
    PARTICIPATION_WORKBOOK_TABLES.KANWIL,
    input.kanwil,
  );

  addDataWorksheet(
    workbook,
    PARTICIPATION_WORKBOOK_SHEETS.KANCAB,
    PARTICIPATION_WORKBOOK_TABLES.KANCAB,
    input.kancab,
  );

  addDataWorksheet(
    workbook,
    PARTICIPATION_WORKBOOK_SHEETS.DIVISI,
    PARTICIPATION_WORKBOOK_TABLES.DIVISI,
    input.divisi,
  );

  addInstructionsWorksheet(
    workbook,
    input.instructions ?? PARTICIPATION_WORKBOOK_INSTRUCTIONS,
  );

  return workbook;
}
