import { Prisma } from "@generated/prisma/client";
import { ApiError } from "@/lib/api/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  loadParticipationWorkbook,
  writeParticipationWorkbook,
} from "@/lib/participation-workbook/exceljs-adapter";
import { generateParticipationWorkbook } from "@/lib/participation-workbook/generator";
import {
  PARTICIPATION_WORKBOOK_INSTRUCTIONS,
  PARTICIPATION_WORKBOOK_SHEET_KEYS,
} from "@/lib/participation-workbook/constants";
import {
  parseParticipationWorkbook,
  ParticipationWorkbookParseError,
} from "@/lib/participation-workbook/parser";
import {
  getCanonicalUnitCode,
  getUnitCodeCanonicalKey,
  normalizeUnitCode,
} from "@/lib/participation-workbook/unit-code";
import type {
  ParticipationWorkbookRow,
  ParticipationWorkbookRowInput,
} from "@/lib/participation-workbook/types";
import { createParticipationSnapshotsInTransaction } from "@/lib/participation-snapshot";
import { correctParticipationSnapshotsInTransaction } from "@/lib/participation-correction";
import { decimalToNumber } from "@/lib/decimal-contract";

type ParticipationDb = Prisma.TransactionClient;

type UnitRecord = {
  id: string;
  kodeOrg: string;
  name: string;
  type: "DIVISI" | "KANTOR_WILAYAH" | "KANTOR_CABANG";
  parent: { name: string } | null;
};

function indexUnitsByCanonicalCode(
  units: readonly UnitRecord[],
): Map<string, UnitRecord> {
  const indexed = new Map<string, UnitRecord>();

  for (const unit of units) {
    const code = getUnitCodeCanonicalKey(unit.kodeOrg);

    if (indexed.has(code)) {
      throw new ApiError(
        `Kode Unit canonical duplikat atau ambigu: ${code}`,
        409,
      );
    }

    indexed.set(code, unit);
  }

  return indexed;
}

type ExistingParticipation = {
  id: string;
  unitId: string;
  headcount: number | null;
  participantCount: number | null;
  percentage: Prisma.Decimal | null;
  provenance: "LEGACY" | "EMPLOYEE_SNAPSHOT";
  employeeSyncRunId: string | null;
  headcountCapturedAt: Date | null;
  unitNameSnapshot: string | null;
  parentUnitNameSnapshot: string | null;
  categoryNameSnapshot: string | null;
  updatedAt: Date;
};

export type ParticipationCorrectionMetadata = {
  unitCode: string;
  overwrite: true;
  reason: string;
  expectedUpdatedAt: string;
};

export type ParticipationWorkbookActionStatus =
  | "FIRST"
  | "UNCHANGED"
  | "CORRECTION"
  | "EMPTY"
  | "ERROR";

export type ParticipationWorkbookPreviewRow = {
  id: number;
  sheetKey: string;
  rowNumber: number;
  unitCode: string;
  unitId: string | null;
  unitName: string;
  participantCount: number | null;
  headcount: number | null;
  percentage: number | null;
  existingParticipantCount: number | null;
  existingPercentage: number | null;
  expectedUpdatedAt: string | null;
  warning: "ZERO_HEADCOUNT" | null;
  status: ParticipationWorkbookActionStatus;
  errorMsg?: string;
};

export type ParticipationWorkbookPreview = {
  stats: {
    total: number;
    first: number;
    unchanged: number;
    correction: number;
    empty: number;
    error: number;
  };
  rows: ParticipationWorkbookPreviewRow[];
};

export type ParticipationWorkbookCommitResult = {
  created: number;
  updated: number;
  skipped: number;
  rows: Array<{
    unitCode: string;
    unitId: string;
    status: "FIRST" | "CORRECTION" | "UNCHANGED";
    participantCount: number;
    percentage: number;
    warning: "ZERO_HEADCOUNT" | null;
    auditId?: string;
  }>;
};

function calculatePercentage(
  participantCount: number,
  headcount: number,
): Prisma.Decimal {
  if (headcount === 0) {
    return new Prisma.Decimal(0).toDecimalPlaces(2);
  }

  return new Prisma.Decimal(participantCount)
    .dividedBy(headcount)
    .times(100)
    .toDecimalPlaces(2);
}

function sheetRows(parsed: ReturnType<typeof parseParticipationWorkbook>) {
  return [
    {
      key: PARTICIPATION_WORKBOOK_SHEET_KEYS.SUMMARY,
      rows: parsed.sheets.summary,
    },
    {
      key: PARTICIPATION_WORKBOOK_SHEET_KEYS.KANWIL,
      rows: parsed.sheets.kanwil,
    },
    {
      key: PARTICIPATION_WORKBOOK_SHEET_KEYS.KANCAB,
      rows: parsed.sheets.kancab,
    },
    {
      key: PARTICIPATION_WORKBOOK_SHEET_KEYS.DIVISI,
      rows: parsed.sheets.divisi,
    },
  ] as const;
}

type FlattenedWorkbookRow = {
  sheetKey: string;
  rowNumber: number;
  row: ParticipationWorkbookRow;
};

export type ReconciledWorkbookRow = {
  unitCode: string;
  sourceRows: FlattenedWorkbookRow[];
  row: ParticipationWorkbookRow;
};

function flattenRows(
  parsed: ReturnType<typeof parseParticipationWorkbook>,
): FlattenedWorkbookRow[] {
  const result: FlattenedWorkbookRow[] = [];

  for (const sheet of sheetRows(parsed)) {
    sheet.rows.forEach((row, index) => {
      result.push({
        sheetKey: sheet.key,
        rowNumber: index + 2,
        row,
      });
    });
  }

  return result;
}

export function reconcileWorkbookRows(
  parsed: ReturnType<typeof parseParticipationWorkbook>,
): ReconciledWorkbookRow[] {
  const byUnitCode = new Map<string, ReconciledWorkbookRow>();

  for (const item of flattenRows(parsed)) {
    const unitCode = normalizeUnitCode(item.row.unitCode);
    const canonicalCode = getUnitCodeCanonicalKey(unitCode);
    const current = byUnitCode.get(canonicalCode);

    if (!current) {
      byUnitCode.set(canonicalCode, {
        unitCode,
        sourceRows: [item],
        row: item.row,
      });
      continue;
    }

    if (current.row.participantCount !== item.row.participantCount) {
      throw new ApiError(
        `Jumlah Partisipasi konflik untuk Kode Unit ${unitCode}; Summary dan sheet unit harus memiliki nilai yang sama`,
        400,
      );
    }

    current.sourceRows.push(item);
  }

  return [...byUnitCode.values()].sort((a, b) =>
    a.unitCode.localeCompare(b.unitCode),
  );
}

async function getUnits(): Promise<UnitRecord[]> {
  return prisma.unit.findMany({
    select: {
      id: true,
      kodeOrg: true,
      name: true,
      type: true,
      parent: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ type: "asc" }, { kodeOrg: "asc" }],
  });
}

async function getCurrentHeadcounts(
  unitIds: readonly string[],
): Promise<Map<string, number>> {
  if (unitIds.length === 0) {
    return new Map();
  }

  const grouped = await prisma.employee.groupBy({
    by: ["unitId"],
    where: {
      unitId: { in: [...unitIds] },
      isPresentInSource: true,
      kodeStatpeg: "01",
      statKepeg: "02",
    },
    _count: {
      _all: true,
    },
  });

  return new Map(
    grouped
      .filter(
        (row): row is typeof row & { unitId: string } => row.unitId !== null,
      )
      .map((row) => [row.unitId, row._count._all]),
  );
}

async function requireExcelImportCategory(categoryId: string) {
  const category = await prisma.programCategory.findUnique({
    where: { id: categoryId },
    select: {
      targetUnit: true,
      evidenceMode: true,
      scoreInputMode: true,
    },
  });

  if (
    !category ||
    category.targetUnit !== "PARTISIPASI_PERSEN" ||
    category.evidenceMode !== "NONE" ||
    category.scoreInputMode !== "EXCEL_IMPORT"
  ) {
    throw new ApiError("Kategori tidak tersedia untuk import Excel", 422);
  }
}

async function lockAndRequireExcelImportCategory(
  tx: ParticipationDb,
  categoryId: string,
) {
  const [category] = await tx.$queryRaw<
    Array<{
      targetUnit: string;
      evidenceMode: string;
      scoreInputMode: string;
    }>
  >(Prisma.sql`
    SELECT "targetUnit", "evidenceMode", "scoreInputMode"
    FROM "ProgramCategory"
    WHERE "id" = ${categoryId}
    FOR UPDATE
  `);

  if (
    !category ||
    category.targetUnit !== "PARTISIPASI_PERSEN" ||
    category.evidenceMode !== "NONE" ||
    category.scoreInputMode !== "EXCEL_IMPORT"
  ) {
    throw new ApiError("Kategori tidak tersedia untuk import Excel", 422);
  }
}

function parseWorkbook(buffer: Buffer) {
  return loadParticipationWorkbook(new Uint8Array(buffer).buffer).catch(
    () => {
      throw new ApiError("File workbook XLSX tidak valid", 400);
    },
  ).then((workbook) => {
    try {
      return parseParticipationWorkbook(workbook);
    } catch (error) {
      if (error instanceof ParticipationWorkbookParseError) {
        throw new ApiError(
          error.issues
            .map(
              (issue) =>
                `${issue.sheetName || "Workbook"} baris ${issue.rowNumber}: ${issue.message}`,
            )
            .join("; "),
          400,
        );
      }

      throw error;
    }
  });
}

function buildWorkbookRows(
  units: readonly UnitRecord[],
  headcounts: Map<string, number>,
): ParticipationWorkbookRowInput[] {
  return units
    .map((unit) => ({
      unitCode: getCanonicalUnitCode(unit),
      unitName: unit.name,
      parentUnitName: unit.parent?.name ?? null,
      headcount: headcounts.get(unit.id) ?? 0,
      participantCount: null,
      percentage: null,
    }))
    .sort((a, b) => a.unitCode.localeCompare(b.unitCode))
    .map((row, index) => ({
      ...row,
      no: index + 1,
    }));
}

function groupWorkbookRows(
  rows: readonly ParticipationWorkbookRowInput[],
  unitsByCode: Map<string, UnitRecord>,
) {
  return {
    summary: [...rows],
    kanwil: rows.filter(
      (row) => unitsByCode.get(getUnitCodeCanonicalKey(row.unitCode))?.type === "KANTOR_WILAYAH",
    ),
    kancab: rows.filter(
      (row) => unitsByCode.get(getUnitCodeCanonicalKey(row.unitCode))?.type === "KANTOR_CABANG",
    ),
    divisi: rows.filter(
      (row) => unitsByCode.get(getUnitCodeCanonicalKey(row.unitCode))?.type === "DIVISI",
    ),
  };
}

export async function buildParticipationTemplate(input: {
  categoryId: string;
  tw: number;
  year: number;
}): Promise<ArrayBuffer> {
  await requireExcelImportCategory(input.categoryId);

  const units = await getUnits();
  const headcounts = await getCurrentHeadcounts(units.map((unit) => unit.id));
  const rows = buildWorkbookRows(units, headcounts);
  const unitsByCode = indexUnitsByCanonicalCode(units);
  const grouped = groupWorkbookRows(rows, unitsByCode);

  const workbook = generateParticipationWorkbook({
    summary: grouped.summary,
    kanwil: grouped.kanwil,
    kancab: grouped.kancab,
    divisi: grouped.divisi,
    instructions: PARTICIPATION_WORKBOOK_INSTRUCTIONS,
  });

  return writeParticipationWorkbook(workbook);
}

export async function buildParticipationExport(input: {
  categoryId: string;
  tw: number;
  year: number;
}): Promise<ArrayBuffer> {
  const category = await prisma.programCategory.findUnique({
    where: { id: input.categoryId },
    select: {
      name: true,
      targetUnit: true,
      evidenceMode: true,
      scoreInputMode: true,
    },
  });

  if (
    !category ||
    category.targetUnit !== "PARTISIPASI_PERSEN" ||
    category.evidenceMode !== "NONE" ||
    category.scoreInputMode !== "EXCEL_IMPORT"
  ) {
    throw new ApiError("Kategori tidak tersedia untuk export Excel", 422);
  }

  const rows = await prisma.participationData.findMany({
    where: {
      categoryId: input.categoryId,
      tw: input.tw,
      year: input.year,
    },
    select: {
      unitId: true,
      headcount: true,
      participantCount: true,
      percentage: true,
      provenance: true,
      employeeSyncRunId: true,
      headcountCapturedAt: true,
      unitNameSnapshot: true,
      parentUnitNameSnapshot: true,
      categoryNameSnapshot: true,
      unit: {
        select: {
          kodeOrg: true,
          type: true,
        },
      },
    },
    orderBy: [{ unit: { kodeOrg: "asc" } }],
  });

  const grouped = {
    summary: [] as ParticipationWorkbookRowInput[],
    kanwil: [] as ParticipationWorkbookRowInput[],
    kancab: [] as ParticipationWorkbookRowInput[],
    divisi: [] as ParticipationWorkbookRowInput[],
  };

  const canonicalCodes = new Set<string>();

  for (const row of rows) {
    const canonicalUnitCode = normalizeUnitCode(row.unit.kodeOrg);

    if (canonicalCodes.has(canonicalUnitCode)) {
      throw new ApiError(
        `Kode Unit canonical duplikat atau ambigu: ${canonicalUnitCode}`,
        409,
      );
    }

    canonicalCodes.add(canonicalUnitCode);

    if (
      row.provenance !== "EMPLOYEE_SNAPSHOT" ||
      row.headcount === null ||
      row.participantCount === null ||
      row.percentage === null ||
      !row.employeeSyncRunId ||
      !row.headcountCapturedAt ||
      !row.unitNameSnapshot ||
      !row.categoryNameSnapshot
    ) {
      throw new ApiError(
        `Data historis unit ${row.unitId} tidak memiliki frozen field yang lengkap`,
        409,
      );
    }

    const workbookRow: ParticipationWorkbookRowInput = {
      unitCode: canonicalUnitCode,
      unitName: row.unitNameSnapshot,
      parentUnitName: row.parentUnitNameSnapshot,
      headcount: row.headcount,
      participantCount: row.participantCount,
      percentage: decimalToNumber(row.percentage),
    };

    grouped.summary.push(workbookRow);

    if (row.unit.type === "KANTOR_WILAYAH") {
      grouped.kanwil.push(workbookRow);
    } else if (row.unit.type === "KANTOR_CABANG") {
      grouped.kancab.push(workbookRow);
    } else {
      grouped.divisi.push(workbookRow);
    }
  }

  for (const rowsForSheet of Object.values(grouped)) {
    rowsForSheet.sort((a, b) => a.unitCode.localeCompare(b.unitCode));
    rowsForSheet.forEach((row, index) => {
      row.no = index + 1;
    });
  }

  const workbook = generateParticipationWorkbook({
    summary: grouped.summary,
    kanwil: grouped.kanwil,
    kancab: grouped.kancab,
    divisi: grouped.divisi,
    instructions: PARTICIPATION_WORKBOOK_INSTRUCTIONS,
  });

  return writeParticipationWorkbook(workbook);
}

function buildPreviewRow(
  id: number,
  item: {
    sheetKey: string;
    rowNumber: number;
    row: ParticipationWorkbookRow;
  },
  unit: UnitRecord | undefined,
  existing: ExistingParticipation | undefined,
  headcount: number | undefined,
): ParticipationWorkbookPreviewRow {
  const row = item.row;

  if (!unit) {
    return {
      id,
      sheetKey: item.sheetKey,
      rowNumber: item.rowNumber,
      unitCode: row.unitCode,
      unitId: null,
      unitName: row.unitName,
      participantCount: row.participantCount,
      headcount: null,
      percentage: null,
      existingParticipantCount: null,
      existingPercentage: null,
      expectedUpdatedAt: null,
      warning: null,
      status: "ERROR",
      errorMsg: "Kode Unit tidak ditemukan di database",
    };
  }

  if (row.participantCount === null) {
    return {
      id,
      sheetKey: item.sheetKey,
      rowNumber: item.rowNumber,
      unitCode: getCanonicalUnitCode(unit),
      unitId: unit.id,
      unitName: unit.name,
      participantCount: null,
      headcount: existing?.headcount ?? headcount ?? null,
      percentage: null,
      existingParticipantCount: existing?.participantCount ?? null,
      existingPercentage:
        existing?.percentage !== null && existing?.percentage !== undefined
          ? decimalToNumber(existing.percentage)
          : null,
      expectedUpdatedAt: existing?.updatedAt.toISOString() ?? null,
      warning: null,
      status: "EMPTY",
    };
  }

  const denominator = existing
    ? existing.headcount
    : headcount === undefined
      ? null
      : headcount;

  if (denominator === null) {
    return {
      id,
      sheetKey: item.sheetKey,
      rowNumber: item.rowNumber,
      unitCode: getCanonicalUnitCode(unit),
      unitId: unit.id,
      unitName: unit.name,
      participantCount: row.participantCount,
      headcount: null,
      percentage: null,
      existingParticipantCount: existing?.participantCount ?? null,
      existingPercentage:
        existing?.percentage !== null && existing?.percentage !== undefined
          ? decimalToNumber(existing.percentage)
          : null,
      expectedUpdatedAt: existing?.updatedAt.toISOString() ?? null,
      warning: null,
      status: "ERROR",
      errorMsg: "Jumlah Karyawan tidak tersedia",
    };
  }

  if (
    !Number.isInteger(row.participantCount) ||
    row.participantCount < 0 ||
    row.participantCount > denominator
  ) {
    return {
      id,
      sheetKey: item.sheetKey,
      rowNumber: item.rowNumber,
      unitCode: getCanonicalUnitCode(unit),
      unitId: unit.id,
      unitName: unit.name,
      participantCount: row.participantCount,
      headcount: denominator,
      percentage: null,
      existingParticipantCount: existing?.participantCount ?? null,
      existingPercentage:
        existing?.percentage !== null && existing?.percentage !== undefined
          ? decimalToNumber(existing.percentage)
          : null,
      expectedUpdatedAt: existing?.updatedAt.toISOString() ?? null,
      warning: null,
      status: "ERROR",
      errorMsg:
        "Jumlah Partisipasi harus berupa bilangan bulat dari 0 sampai Jumlah Karyawan",
    };
  }

  const percentage = calculatePercentage(
    row.participantCount,
    denominator,
  ).toNumber();

  if (!existing) {
    return {
      id,
      sheetKey: item.sheetKey,
      rowNumber: item.rowNumber,
      unitCode: getCanonicalUnitCode(unit),
      unitId: unit.id,
      unitName: unit.name,
      participantCount: row.participantCount,
      headcount: denominator,
      percentage,
      existingParticipantCount: null,
      existingPercentage: null,
      expectedUpdatedAt: null,
      warning: denominator === 0 ? "ZERO_HEADCOUNT" : null,
      status: "FIRST",
    };
  }

  if (existing.participantCount === row.participantCount) {
    return {
      id,
      sheetKey: item.sheetKey,
      rowNumber: item.rowNumber,
      unitCode: getCanonicalUnitCode(unit),
      unitId: unit.id,
      unitName: unit.name,
      participantCount: row.participantCount,
      headcount: denominator,
      percentage,
      existingParticipantCount: existing.participantCount,
      existingPercentage:
        existing.percentage !== null && existing.percentage !== undefined
          ? decimalToNumber(existing.percentage)
          : null,
      expectedUpdatedAt: existing.updatedAt.toISOString(),
      warning: denominator === 0 ? "ZERO_HEADCOUNT" : null,
      status: "UNCHANGED",
    };
  }

  return {
    id,
    sheetKey: item.sheetKey,
    rowNumber: item.rowNumber,
    unitCode: getCanonicalUnitCode(unit),
    unitId: unit.id,
    unitName: unit.name,
    participantCount: row.participantCount,
    headcount: denominator,
    percentage,
    existingParticipantCount: existing.participantCount,
    existingPercentage:
      existing.percentage !== null && existing.percentage !== undefined
        ? decimalToNumber(existing.percentage)
        : null,
    expectedUpdatedAt: existing.updatedAt.toISOString(),
    warning: denominator === 0 ? "ZERO_HEADCOUNT" : null,
    status: "CORRECTION",
  };
}

export async function previewParticipationWorkbook(input: {
  buffer: Buffer;
  categoryId: string;
  tw: number;
  year: number;
}): Promise<ParticipationWorkbookPreview> {
  await requireExcelImportCategory(input.categoryId);
  const parsed = await parseWorkbook(input.buffer);
  const units = await getUnits();
  const unitByCode = indexUnitsByCanonicalCode(units);
  const headcounts = await getCurrentHeadcounts(units.map((unit) => unit.id));

  const existingRows = await prisma.participationData.findMany({
    where: {
      categoryId: input.categoryId,
      tw: input.tw,
      year: input.year,
    },
    select: {
      id: true,
      unitId: true,
      headcount: true,
      participantCount: true,
      percentage: true,
      provenance: true,
      employeeSyncRunId: true,
      headcountCapturedAt: true,
      unitNameSnapshot: true,
      parentUnitNameSnapshot: true,
      categoryNameSnapshot: true,
      updatedAt: true,
    },
  });

  const existingByUnitId = new Map(
    existingRows.map((row) => [row.unitId, row as ExistingParticipation]),
  );

  const reconciledRows = reconcileWorkbookRows(parsed);

  const rows = reconciledRows.map((item, index) => {
    const unit = unitByCode.get(getUnitCodeCanonicalKey(item.unitCode));

    return buildPreviewRow(
      index,
      {
        sheetKey: item.sourceRows[0]?.sheetKey ?? "UNKNOWN",
        rowNumber: item.sourceRows[0]?.rowNumber ?? 0,
        row: item.row,
      },
      unit,
      unit ? existingByUnitId.get(unit.id) : undefined,
      unit ? headcounts.get(unit.id) : undefined,
    );
  });

  return {
    stats: {
      total: rows.length,
      first: rows.filter((row) => row.status === "FIRST").length,
      unchanged: rows.filter((row) => row.status === "UNCHANGED").length,
      correction: rows.filter((row) => row.status === "CORRECTION").length,
      empty: rows.filter((row) => row.status === "EMPTY").length,
      error: rows.filter((row) => row.status === "ERROR").length,
    },
    rows,
  };
}

export async function commitParticipationWorkbook(input: {
  buffer: Buffer;
  categoryId: string;
  tw: number;
  year: number;
  corrections: ParticipationCorrectionMetadata[];
  actorId: string;
  actorName: string;
}): Promise<ParticipationWorkbookCommitResult> {
  const preview = await previewParticipationWorkbook({
    buffer: input.buffer,
    categoryId: input.categoryId,
    tw: input.tw,
    year: input.year,
  });

  const emptyRows = preview.rows.filter((row) => row.status === "EMPTY");

  if (emptyRows.length > 0) {
    throw new ApiError(
      emptyRows
        .map((row) => `${row.unitCode}: Jumlah Partisipasi wajib diisi`)
        .join("; "),
      400,
    );
  }

  const validRows = preview.rows;
  const errors = validRows.filter((row) => row.status === "ERROR");

  if (errors.length > 0) {
    throw new ApiError(
      errors
        .map((row) => `${row.unitCode}: ${row.errorMsg ?? "Baris tidak valid"}`)
        .join("; "),
      400,
    );
  }

  const correctionByCode = new Map<string, ParticipationCorrectionMetadata>();

  for (const correction of input.corrections) {
    const code = normalizeUnitCode(correction.unitCode);
    const canonicalCode = getUnitCodeCanonicalKey(code);

    if (correctionByCode.has(canonicalCode)) {
      throw new ApiError(
        `Metadata koreksi duplikat untuk Kode Unit ${code}`,
        400,
      );
    }

    if (
      correction.overwrite !== true ||
      correction.reason.trim().length < 1 ||
      correction.reason.trim().length > 500 ||
      Number.isNaN(new Date(correction.expectedUpdatedAt).getTime())
    ) {
      throw new ApiError(
        `Metadata koreksi tidak valid untuk Kode Unit ${code}`,
        400,
      );
    }

    correctionByCode.set(canonicalCode, {
      ...correction,
      unitCode: code,
      reason: correction.reason.trim(),
    });
  }

  const actionableRows = validRows.filter(
    (row) => row.status === "FIRST" || row.status === "CORRECTION",
  );

  for (const row of actionableRows) {
    const metadata = correctionByCode.get(getUnitCodeCanonicalKey(row.unitCode));

    if (row.status === "CORRECTION" && !metadata) {
      throw new ApiError(
        `Metadata koreksi wajib untuk Kode Unit ${row.unitCode}`,
        400,
      );
    }

    if (row.status === "FIRST" && metadata) {
      throw new ApiError(
        `Metadata koreksi tidak boleh dikirim untuk FIRST ${row.unitCode}`,
        400,
      );
    }

    if (
      row.status === "CORRECTION" &&
      metadata &&
      metadata.expectedUpdatedAt !== row.expectedUpdatedAt
    ) {
      throw new ApiError(
        `Versi data koreksi tidak cocok untuk Kode Unit ${row.unitCode}`,
        409,
      );
    }
  }

  for (const metadata of correctionByCode.values()) {
    if (!actionableRows.some((row) => getUnitCodeCanonicalKey(row.unitCode) === getUnitCodeCanonicalKey(metadata.unitCode))) {
      throw new ApiError(
        `Metadata koreksi tidak memiliki baris CORRECTION yang cocok: ${metadata.unitCode}`,
        400,
      );
    }
  }

  const firstRows = actionableRows
    .filter(
      (
        row,
      ): row is typeof row & {
        status: "FIRST";
        unitId: string;
        participantCount: number;
      } =>
        row.status === "FIRST" &&
        row.unitId !== null &&
        row.participantCount !== null,
    )
    .sort((a, b) => a.unitId.localeCompare(b.unitId));

  const correctionRows = actionableRows
    .filter(
      (
        row,
      ): row is typeof row & {
        status: "CORRECTION";
        unitId: string;
        participantCount: number;
        expectedUpdatedAt: string;
      } =>
        row.status === "CORRECTION" &&
        row.unitId !== null &&
        row.participantCount !== null &&
        row.expectedUpdatedAt !== null,
    )
    .sort((a, b) => a.unitId.localeCompare(b.unitId));

  return prisma.$transaction(
    async (tx: ParticipationDb) => {
      await lockAndRequireExcelImportCategory(tx, input.categoryId);

      const snapshots =
        firstRows.length > 0
          ? await createParticipationSnapshotsInTransaction(
              {
                categoryId: input.categoryId,
                tw: input.tw,
                year: input.year,
                rows: firstRows.map((row) => ({
                  unitId: row.unitId,
                  participantCount: row.participantCount,
                })),
              },
              tx,
            )
          : [];

      const corrections =
        correctionRows.length > 0
          ? await correctParticipationSnapshotsInTransaction(
              {
                categoryId: input.categoryId,
                tw: input.tw,
                year: input.year,
                actorId: input.actorId,
                actorName: input.actorName,
                rows: correctionRows.map((row) => {
                  const metadata = correctionByCode.get(getUnitCodeCanonicalKey(row.unitCode))!;

                  return {
                    unitId: row.unitId,
                    participantCount: row.participantCount,
                    overwrite: metadata.overwrite,
                    reason: metadata.reason,
                    expectedUpdatedAt: metadata.expectedUpdatedAt,
                  };
                }),
              },
              tx,
            )
          : [];

      const resultRows = [
        ...snapshots.map((row) => ({
          unitCode:
            firstRows.find((candidate) => candidate.unitId === row.unitId)
              ?.unitCode ?? row.unitId,
          unitId: row.unitId,
          status: "FIRST" as const,
          participantCount: row.participantCount,
          percentage: row.percentage.toNumber(),
          warning: row.warning,
        })),
        ...corrections.map((row) => ({
          unitCode:
            correctionRows.find((candidate) => candidate.unitId === row.unitId)
              ?.unitCode ?? row.unitId,
          unitId: row.unitId,
          status:
            row.status === "UPDATED"
              ? ("CORRECTION" as const)
              : ("UNCHANGED" as const),
          participantCount: row.participantCount,
          percentage: row.percentage.toNumber(),
          warning: row.warning,
          ...(row.auditId ? { auditId: row.auditId } : {}),
        })),
      ].sort((a, b) => a.unitCode.localeCompare(b.unitCode));

      return {
        created: snapshots.length,
        updated: corrections.filter((row) => row.status === "UPDATED").length,
        skipped:
          preview.rows.filter((row) => row.status === "UNCHANGED").length +
          corrections.filter((row) => row.status === "UNCHANGED").length,
        rows: resultRows,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
