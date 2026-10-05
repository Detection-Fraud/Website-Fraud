import { createHash, randomBytes } from "node:crypto";
import { validateXlsxArchive, validateWorksheetRowBounds } from "@/lib/xlsx-archive-guard";
import ExcelJS from "exceljs";
import { Prisma } from "@generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { recoverExpiredEmployeeExcelRuns } from "@/lib/employee-sync";
import { parseEmployeeSnapshot } from "@/lib/employee-sync-contract";
import { adaptPentahoEmployeeBatch, PENTAHO_EMPLOYEE_HEADERS, PentahoEmployeeAdapterError } from "@/lib/pentaho-employee-adapter";
import { EmployeeSnapshotValidationError, inspectEmployeeSnapshotForPreview, syncEmployeeSnapshotForRun } from "@/lib/employee-sync";
import type { EmployeeImportImpact } from "@/schemas/employee-import.schema";

export const EMPLOYEE_IMPORT_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const EMPLOYEE_IMPORT_MAX_ROWS = 100_000;
// Keep aggregate expansion bounded because ExcelJS materializes parsed cells
// as JS objects after the ZIP/XML preflight.
const MAX_ZIP_ENTRY_BYTES = 80 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 96 * 1024 * 1024;
const PREVIEW_TTL_MS = 15 * 60 * 1000;
const SOURCE_SYSTEM = "PENTAHO" as const;
export const EMPLOYEE_EXCEL_HEADERS = PENTAHO_EMPLOYEE_HEADERS.slice(0, 14);
const EXCEL_METADATA_PLACEHOLDER_AT = new Date("1970-01-01T00:00:00.000Z");
const EXCEL_METADATA_ACTOR = "Excel Import";
const EMPLOYEE_IMPORT_DEADLINE_MS = 10 * 60_000;
export function validateEmployeeWorksheetRowBounds(xml: string): void {
  try {
    validateWorksheetRowBounds(xml, EMPLOYEE_IMPORT_MAX_ROWS);
  } catch {
    throw new EmployeeImportError("INVALID_WORKBOOK");
  }
}

export type EmployeeImportErrorCode =
  | "INVALID_FILE" | "FILE_TOO_LARGE" | "INVALID_WORKBOOK" | "INVALID_SNAPSHOT"
  | "ACTIVE_RUN" | "PREVIEW_INVALID" | "PREVIEW_EXPIRED" | "PREVIEW_REPLAYED"
  | "FILE_MISMATCH" | "STALE_BASELINE" | "IMPACT_CHANGED" | "CONFIRMATION_REQUIRED"
  | "CONCURRENT_RUN" | "COMMIT_FAILED";

export class EmployeeImportError extends Error {
  constructor(readonly code: EmployeeImportErrorCode) {
    super(code);
    this.name = "EmployeeImportError";
  }
}

function validateZip(buffer: Buffer): void {
  if (buffer.length < 22 || buffer.length > EMPLOYEE_IMPORT_MAX_FILE_BYTES) {
    throw new EmployeeImportError(buffer.length > EMPLOYEE_IMPORT_MAX_FILE_BYTES ? "FILE_TOO_LARGE" : "INVALID_FILE");
  }
  try {
    validateXlsxArchive(buffer, {
      maxRows: EMPLOYEE_IMPORT_MAX_ROWS,
      maxFileBytes: EMPLOYEE_IMPORT_MAX_FILE_BYTES,
      maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
      maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
    });
  } catch {
    throw new EmployeeImportError("INVALID_WORKBOOK");
  }
}

export function createEmployeeImportTemplate(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Karyawan");
  sheet.addRow([...EMPLOYEE_EXCEL_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns = EMPLOYEE_EXCEL_HEADERS.map((header) => ({ header, key: header, width: 22 }));
  return workbook.xlsx.writeBuffer();
}

export async function parseEmployeeXlsx(fileName: string, buffer: Buffer) {
  if (!fileName.toLowerCase().endsWith(".xlsx")) throw new EmployeeImportError("INVALID_FILE");
  validateZip(buffer);
  let workbook: ExcelJS.Workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
  } catch {
    throw new EmployeeImportError("INVALID_WORKBOOK");
  }
  if (workbook.worksheets.length !== 1 || workbook.worksheets[0]?.name !== "Karyawan" || workbook.worksheets[0]?.state !== "visible") {
    throw new EmployeeImportError("INVALID_WORKBOOK");
  }
  const sheet = workbook.worksheets[0];
  if (sheet.columnCount !== EMPLOYEE_EXCEL_HEADERS.length || sheet.rowCount < 2 || sheet.rowCount - 1 > EMPLOYEE_IMPORT_MAX_ROWS) {
    throw new EmployeeImportError("INVALID_WORKBOOK");
  }
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let column = 1; column <= EMPLOYEE_EXCEL_HEADERS.length; column++) {
    const value = headerRow.getCell(column).value;
    if (typeof value !== "string" || value !== EMPLOYEE_EXCEL_HEADERS[column - 1]) {
      throw new EmployeeImportError("INVALID_WORKBOOK");
    }
    headers.push(value);
  }
  const rows: Array<Record<string, unknown>> = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values: unknown[] = [];
    let hasValue = false;
    for (let column = 1; column <= EMPLOYEE_EXCEL_HEADERS.length; column++) {
      const value = row.getCell(column).value;
      if (typeof value === "object" && value !== null) throw new EmployeeImportError("INVALID_WORKBOOK");
      if (value !== null && value !== undefined && value !== "") hasValue = true;
      values.push(value);
    }
    if (!hasValue) throw new EmployeeImportError("INVALID_WORKBOOK");
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  }
  try {
    const pentahoRows = rows.map((row) => ({
      ...row,
      CREATED_AT: EXCEL_METADATA_PLACEHOLDER_AT.toISOString(),
      CREATED_BY: EXCEL_METADATA_ACTOR,
      UPDATED_AT: EXCEL_METADATA_PLACEHOLDER_AT.toISOString(),
      UPDATED_BY: EXCEL_METADATA_ACTOR,
    }));
    return adaptPentahoEmployeeBatch(
      [...headers, "CREATED_AT", "CREATED_BY", "UPDATED_AT", "UPDATED_BY"],
      pentahoRows,
    );
  } catch (error) {
    if (error instanceof PentahoEmployeeAdapterError || error instanceof EmployeeSnapshotValidationError) {
      throw new EmployeeImportError("INVALID_SNAPSHOT");
    }
    throw error;
  }
}

function hash(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function reapExpiredPreviews(now: Date): Promise<void> {
  const expired = await prisma.employeeImportPreview.findMany({
    where: { expiresAt: { lte: now } }, select: { id: true }, take: 100, orderBy: { expiresAt: "asc" },
  });
  if (expired.length) await prisma.employeeImportPreview.deleteMany({ where: { id: { in: expired.map((row) => row.id) } } });
}

async function currentBaseline(tx: Prisma.TransactionClient): Promise<string | null> {
  const latest = await tx.employeeSyncRun.findFirst({
    where: { sourceSystem: SOURCE_SYSTEM, status: "SUCCEEDED" },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }], select: { id: true },
  });
  return latest?.id ?? null;
}

export async function previewEmployeeImport(adminId: string, fileName: string, bytes: Buffer) {
  const snapshot = await parseEmployeeXlsx(fileName, bytes);
  let inspection: Awaited<ReturnType<typeof inspectEmployeeSnapshotForPreview>>;
  let baselineRunId: string | null;
  try {
    [inspection, baselineRunId] = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ lockAcquired: boolean }>>(Prisma.sql`
        SELECT pg_try_advisory_xact_lock(hashtext('employee-sync:PENTAHO')::bigint) AS "lockAcquired"
      `);
      if (!locked[0]?.lockAcquired) throw new EmployeeImportError("ACTIVE_RUN");
      const [impact, baseline] = await Promise.all([
        inspectEmployeeSnapshotForPreview(tx, snapshot, { ignoreSourceAuditMetadata: true }),
        currentBaseline(tx),
      ]);
      return [impact, baseline] as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 300_000 });
  } catch (error) {
    if (error instanceof EmployeeImportError) throw error;
    if (error instanceof EmployeeSnapshotValidationError) throw new EmployeeImportError("INVALID_SNAPSHOT");
    throw error;
  }
  const now = new Date();
  await reapExpiredPreviews(now);
  const previewToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);
  await prisma.employeeImportPreview.create({
    data: {
      tokenHash: hash(previewToken), initiatedById: adminId, fileHash: hash(bytes),
      baselineRunId, impactHash: inspection.impactHash, expiresAt,
    },
  });
  const impact: EmployeeImportImpact = {
    newCount: inspection.newCount,
    changedCount: inspection.changedCount,
    unchangedCount: inspection.unchangedCount,
    missingCount: inspection.missingCount,
    deactivationCount: inspection.deactivationCount,
    details: inspection.details,
  };
  return { previewToken, expiresAt, rowCount: snapshot.employees.length, impact };
}

export async function commitEmployeeImport(
  adminId: string,
  previewToken: string,
  fileName: string,
  bytes: Buffer,
) {
  const snapshot = await parseEmployeeXlsx(fileName, bytes);
  const tokenHash = hash(previewToken);
  const preview = await prisma.employeeImportPreview.findFirst({ where: { tokenHash, initiatedById: adminId } });
  if (!preview) throw new EmployeeImportError("PREVIEW_INVALID");
  const now = new Date();
  if (preview.expiresAt <= now) throw new EmployeeImportError("PREVIEW_EXPIRED");
  if (preview.consumedAt) throw new EmployeeImportError("PREVIEW_REPLAYED");
  if (preview.fileHash !== hash(bytes)) throw new EmployeeImportError("FILE_MISMATCH");

  await recoverExpiredEmployeeExcelRuns(new Date());
  const active = await prisma.employeeSyncRun.findFirst({
    where: { sourceSystem: SOURCE_SYSTEM, status: "RUNNING" }, select: { id: true },
  });
  if (active) throw new EmployeeImportError("ACTIVE_RUN");

  let runId: string;
  try {
    const run = await prisma.employeeSyncRun.create({
      data: {
        sourceSystem: SOURCE_SYSTEM, channel: "EXCEL_IMPORT", status: "RUNNING", phase: "VALIDATING",
        triggeredById: adminId, receivedCount: snapshot.employees.length,
        deadlineAt: new Date(Date.now() + EMPLOYEE_IMPORT_DEADLINE_MS),
      }, select: { id: true },
    });
    runId = run.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new EmployeeImportError("CONCURRENT_RUN");
    }
    throw error;
  }

  try {
    const result = await syncEmployeeSnapshotForRun(runId, snapshot, {
      expectedChannel: "EXCEL_IMPORT",
      transactionGuard: async (tx) => {
        const baseline = await currentBaseline(tx);
        if (baseline !== preview.baselineRunId) throw new EmployeeImportError("STALE_BASELINE");
        const fresh = await previewEmployeeSnapshotImpactInTransaction(tx, snapshot);
        if (fresh.impactHash !== preview.impactHash) throw new EmployeeImportError("IMPACT_CHANGED");
        const consumed = await tx.employeeImportPreview.updateMany({
          where: {
            id: preview.id, tokenHash, initiatedById: adminId, fileHash: hash(bytes),
            baselineRunId: preview.baselineRunId, impactHash: preview.impactHash,
            consumedAt: null, expiresAt: { gt: new Date() },
          },
          data: { consumedAt: new Date() },
        });
        if (consumed.count !== 1) throw new EmployeeImportError("PREVIEW_REPLAYED");
      },
    });
    return { runId: result.runId, sourceSystem: SOURCE_SYSTEM, channel: "EXCEL_IMPORT" as const,
      status: "SUCCEEDED" as const, receivedCount: result.receivedCount, processedCount: result.processedCount,
      missingCount: result.missingCount, deactivatedCount: result.deactivatedCount };
  } catch (error) {
    if (error instanceof EmployeeImportError) throw error;
    throw new EmployeeImportError("COMMIT_FAILED");
  }
}

async function previewEmployeeSnapshotImpactInTransaction(tx: Prisma.TransactionClient, snapshot: unknown) {
  const normalized = parseEmployeeSnapshot(snapshot);
  return inspectEmployeeSnapshotForPreview(tx, normalized, { ignoreSourceAuditMetadata: true });
}
