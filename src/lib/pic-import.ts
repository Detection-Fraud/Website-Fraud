import ExcelJS from "exceljs";
import { Prisma, type PrismaClient } from "@generated/prisma/client";
import { isPicEligible } from "@/lib/employee-eligibility";
import { createPicUser } from "@/lib/user-management";
import { prisma } from "@/lib/prisma";
import { validateXlsxArchive } from "@/lib/xlsx-archive-guard";
import { readPicImportDatabaseTarget } from "@/lib/pic-import-target";

export const PIC_IMPORT_HEADERS = ["NIP", "UNIT_KERJA"] as const;
export const PIC_IMPORT_HEADER_ROW = 5;
export const PIC_IMPORT_MAX_ROWS = 1000;
export const PIC_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const PIC_IMPORT_MAX_UNITS = 5000;
const REVIEWED_PIC_UNIT_ALIASES = new Map([
  ["sekretariat perusahaan", "sekretaris perusahaan"],
  ["kancav langgur", "kantor cabang langgur"],
  ["ub jastasma", "ub-jastasma"],
  ["ub-sentra niaga", "ub-bulog sentra niaga"],
  ["kantor cabang blangpidie", "kantor cabang blang pidie"],
  ["kantor wilayah jakarta dan banten", "kantor wilayah dki jakarta dan banten"],
  ["kacab bogor", "kantor cabang bogor"],
  ["kantor cabang putusibau", "kantor cabang putussibau"],
  ["kantor cabang luwuk", "kantor cabang luwuk banggai"],
  ["kantor cabang tolitoli", "kantor cabang toli-toli"],
  ["kantor cabang polewali mandar", "kantor cabang polman"],
  ["kantor wilayah papua dan pabar", "kantor wilayah papua"],
  ["kantor cabang fak-fak", "kantor cabang fak fak"],
  ["kantor cabang tembinabuan", "kantor cabang teminabuan"],
]);

const accountSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true, username: true, samlNameId: true, employeeId: true,
  authProvider: true, role: true, isActive: true, unitId: true,
});
const employeeSelect = Prisma.validator<Prisma.EmployeeSelect>()({
  id: true, nip: true, name: true, jenjang: true, kodeStatpeg: true, statKepeg: true,
  isPresentInSource: true, unitId: true,
  unit: { select: { id: true, name: true } },
});
export type PicImportEmployeeSnapshot = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;
export type PicImportAccountSnapshot = Prisma.UserGetPayload<{ select: typeof accountSelect }>;
export type PicImportInputRow = { rowNumber: number; nip: string; unitName: string };
export type PicImportPlanRow = PicImportInputRow & {
  status: "CREATE" | "ALREADY_ASSIGNED" | "REVIEW" | "ERROR";
  reason: string;
  employeeId?: string;
  unitId?: string;
  employeeUnitName?: string;
};
export type PicImportPlan = {
  rows: PicImportPlanRow[];
  counts: Record<PicImportPlanRow["status"], number>;
  canApply: boolean;
};
export class PicImportWorkbookError extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "PicImportWorkbookError";
  }
}
export class PicImportOperationError extends Error {
  constructor(message: string) { super(message); this.name = "PicImportOperationError"; }
}
export function normalizePicUnitName(value: string): string {
  const normalized = value.replace(/&/g, " dan ").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID")
    .replace(/\bkanwil\b/g, "kantor wilayah")
    .replace(/\bkancab\b/g, "kantor cabang")
    .replace(/\bpmo\b/g, "project management office")
    .replace(/\btanggerang\b/g, "tangerang");
  return REVIEWED_PIC_UNIT_ALIASES.get(normalized) ?? normalized;
}

export function canApplyPicImportPlan(plan: PicImportPlan, skipInvalid = false): boolean {
  if (!skipInvalid) return plan.canApply;
  // Duplicate identities remain a file-level error, even in partial mode.
  return !plan.rows.some(row => row.reason === "DUPLICATE_NIP") &&
    plan.rows.some(row => row.status === "CREATE" || row.status === "ALREADY_ASSIGNED");
}

export function assertPicImportPreviewReceipt(
  receipt: unknown,
  confirmation: { fileSha256: string; targetFingerprint: string; skipInvalid: boolean },
  plan: PicImportPlan,
): void {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new PicImportOperationError("Laporan pratinjau tidak valid");
  }
  const saved = receipt as Record<string, unknown>;
  if (saved.version !== 2 || saved.fileSha256 !== confirmation.fileSha256 ||
      saved.targetFingerprint !== confirmation.targetFingerprint || saved.skipInvalid !== confirmation.skipInvalid ||
      saved.canApply !== true || !canApplyPicImportPlan(plan, confirmation.skipInvalid) ||
      JSON.stringify(saved.rows) !== JSON.stringify(plan.rows)) {
    throw new PicImportOperationError("Pratinjau tidak cocok, mode berbeda, atau data berubah; jalankan ulang pratinjau");
  }
}

export async function parsePicImportWorkbook(fileName: string, buffer: Buffer): Promise<PicImportInputRow[]> {
  if (!fileName.toLowerCase().endsWith(".xlsx") || buffer.length < 22) throw new PicImportWorkbookError("INVALID_FILE");
  if (buffer.length > PIC_IMPORT_MAX_FILE_BYTES) throw new PicImportWorkbookError("FILE_TOO_LARGE");
  const workbook = new ExcelJS.Workbook();
  try {
    validateXlsxArchive(buffer, {
      maxRows: PIC_IMPORT_MAX_ROWS + PIC_IMPORT_HEADER_ROW - 1,
      maxFileBytes: PIC_IMPORT_MAX_FILE_BYTES,
      maxEntryBytes: 10 * 1024 * 1024, maxTotalBytes: 20 * 1024 * 1024,
    });
    await workbook.xlsx.load(buffer as never);
  } catch { throw new PicImportWorkbookError("INVALID_WORKBOOK"); }
  const sheet = workbook.worksheets[0];
  if (workbook.worksheets.length !== 1 || sheet?.name !== "PIC" || sheet.state !== "visible" ||
      sheet.columnCount !== 2 || sheet.rowCount > PIC_IMPORT_MAX_ROWS + PIC_IMPORT_HEADER_ROW) {
    throw new PicImportWorkbookError("INVALID_WORKBOOK");
  }
  for (let column = 1; column <= 2; column++) {
    if (sheet.getRow(PIC_IMPORT_HEADER_ROW).getCell(column).value !== PIC_IMPORT_HEADERS[column - 1]) {
      throw new PicImportWorkbookError("INVALID_WORKBOOK");
    }
  }
  const rows: PicImportInputRow[] = [];
  const seen = new Set<string>();
  for (let rowNumber = PIC_IMPORT_HEADER_ROW + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const nip = sheet.getRow(rowNumber).getCell(1).value;
    const unit = sheet.getRow(rowNumber).getCell(2).value;
    if ((nip == null || nip === "") && (unit == null || unit === "")) continue;
    if (typeof nip !== "string" || !nip.trim()) {
      throw new PicImportWorkbookError("INVALID_ROW", `Baris ${rowNumber}, sel A${rowNumber}: NIP wajib diisi sebagai teks. Ketik ulang NIP lengkap sebagai teks; format Text saja tidak mengubah angka yang sudah tersimpan.`);
    }
    if (typeof unit !== "string" || !unit.trim()) {
      throw new PicImportWorkbookError("INVALID_ROW", `Baris ${rowNumber}, sel B${rowNumber}: UNIT_KERJA wajib diisi sebagai teks.`);
    }
    if (seen.has(nip.trim())) throw new PicImportWorkbookError("DUPLICATE_NIP", `Baris ${rowNumber}, sel A${rowNumber}: NIP duplikat.`);
    seen.add(nip.trim());
    rows.push({ rowNumber, nip: nip.trim(), unitName: unit.trim() });
  }
  if (!rows.length) throw new PicImportWorkbookError("EMPTY_IMPORT");
  return rows;
}

export function planPicImport(
  input: readonly PicImportInputRow[],
  employees: readonly PicImportEmployeeSnapshot[],
  accounts: readonly PicImportAccountSnapshot[],
  units: readonly { id: string; name: string }[] = employees.flatMap(employee => employee.unit ? [employee.unit] : []),
): PicImportPlan {
  const byNip = new Map(employees.map(employee => [employee.nip, employee]));
  const unitsByName = new Map<string, Set<string>>();
  for (const unit of units) {
    const name = normalizePicUnitName(unit.name);
    if (!unitsByName.has(name)) unitsByName.set(name, new Set());
    unitsByName.get(name)!.add(unit.id);
  }
  const seen = new Set<string>();
  const rows = input.map((row): PicImportPlanRow => {
    const employee = byNip.get(row.nip);
    if (seen.has(row.nip)) return { ...row, status: "ERROR", reason: "DUPLICATE_NIP" };
    seen.add(row.nip);
    if (!employee) return { ...row, status: "ERROR", reason: "EMPLOYEE_NOT_FOUND" };
    if (!isPicEligible(employee)) return { ...row, status: "ERROR", reason: "EMPLOYEE_INELIGIBLE" };
    if (!employee.unitId || !employee.unit || employee.unit.id !== employee.unitId) {
      return { ...row, status: "ERROR", reason: "EMPLOYEE_UNIT_UNAVAILABLE" };
    }
    if (normalizePicUnitName(employee.unit.name) !== normalizePicUnitName(row.unitName)) {
      const comparison = { ...row, employeeUnitName: employee.unit.name };
      const requestedUnits = unitsByName.get(normalizePicUnitName(row.unitName));
      if (!requestedUnits?.size) {
        return { ...comparison, status: "REVIEW", reason: "UNIT_NAME_REQUIRES_REVIEW" };
      }
      if (requestedUnits.size > 1) {
        return { ...comparison, status: "REVIEW", reason: "UNIT_NAME_AMBIGUOUS" };
      }
      if (requestedUnits.has(employee.unitId)) {
        return { ...comparison, status: "REVIEW", reason: "UNIT_DATA_CHANGED" };
      }
      return { ...comparison, status: "ERROR", reason: "UNIT_MISMATCH" };
    }
    const assignment = { ...row, employeeId: employee.id, unitId: employee.unitId, employeeUnitName: employee.unit.name };
    const matches = accounts.filter(account => account.employeeId === employee.id ||
      account.username === row.nip || account.samlNameId === row.nip);
    if (!matches.length) return { ...assignment, status: "CREATE", reason: "NEW_ACCOUNT" };
    const account = matches[0];
    if (matches.length === 1 && account.authProvider === "SSO" && account.role === "PIC" &&
        account.isActive && account.employeeId === employee.id && account.unitId === employee.unitId &&
        account.username === row.nip && account.samlNameId === row.nip) {
      return { ...assignment, status: "ALREADY_ASSIGNED", reason: "ACTIVE_PIC_MATCHES" };
    }
    return { ...assignment, status: "REVIEW", reason: "EXISTING_ACCOUNT_REQUIRES_ADMIN_REVIEW" };
  });
  const counts = { CREATE: 0, ALREADY_ASSIGNED: 0, REVIEW: 0, ERROR: 0 };
  for (const row of rows) counts[row.status]++;
  return { rows, counts, canApply: rows.length > 0 && !counts.REVIEW && !counts.ERROR };
}

async function loadPicImport(input: readonly PicImportInputRow[], db: PrismaClient | Prisma.TransactionClient) {
  if (!input.length || input.length > PIC_IMPORT_MAX_ROWS) throw new PicImportOperationError("Jumlah PIC tidak valid");
  const nips = input.map(row => row.nip);
  const employees = await db.employee.findMany({ where: { nip: { in: nips } }, select: employeeSelect, take: PIC_IMPORT_MAX_ROWS });
  const accounts = await db.user.findMany({
    where: { OR: [
      { username: { in: nips } }, { samlNameId: { in: nips } },
      { employeeId: { in: employees.map(employee => employee.id) } },
    ] },
    select: accountSelect, take: PIC_IMPORT_MAX_ROWS * 3 + 1,
  });
  if (accounts.length > PIC_IMPORT_MAX_ROWS * 3) throw new PicImportOperationError("Terlalu banyak konflik akun");
  const units = await db.unit.findMany({ select: { id: true, name: true }, take: PIC_IMPORT_MAX_UNITS + 1 });
  if (units.length > PIC_IMPORT_MAX_UNITS) throw new PicImportOperationError("Jumlah unit melebihi batas pemeriksaan");
  return { employees, plan: planPicImport(input, employees, accounts, units) };
}
export async function previewPicImport(input: readonly PicImportInputRow[], db: PrismaClient = prisma) {
  return (await loadPicImport(input, db)).plan;
}

export async function applyPicImportAssignments(
  input: readonly PicImportInputRow[],
  expectedPlan: PicImportPlan,
  confirmation: { adminUserId: string; targetFingerprint: string; skipInvalid?: boolean },
  db: PrismaClient = prisma,
) {
  if (!canApplyPicImportPlan(expectedPlan, confirmation.skipInvalid)) {
    throw new PicImportOperationError("Pratinjau belum dapat diterapkan");
  }
  return db.$transaction(async tx => {
    const admin = await tx.user.findUnique({ where: { id: confirmation.adminUserId },
      select: { role: true, isActive: true, authProvider: true } });
    if (!admin || admin.role !== "ADMIN" || !admin.isActive || admin.authProvider !== "SSO") {
      throw new PicImportOperationError("Admin SSO aktif wajib dikonfirmasi");
    }
    const target = await readPicImportDatabaseTarget(tx);
    if (target.fingerprint !== confirmation.targetFingerprint) throw new PicImportOperationError("Target database berubah");
    const { employees, plan } = await loadPicImport(input, tx);
    if (!canApplyPicImportPlan(plan, confirmation.skipInvalid) || JSON.stringify(plan.rows) !== JSON.stringify(expectedPlan.rows)) {
      throw new PicImportOperationError("Data berubah setelah pratinjau; jalankan pratinjau ulang");
    }
    const byId = new Map(employees.map(employee => [employee.id, employee]));
    for (const row of plan.rows) {
      if (row.status !== "CREATE") continue;
      const employee = byId.get(row.employeeId!);
      if (!employee || !row.unitId) throw new PicImportOperationError("Penetapan tidak valid");
      await createPicUser(tx, employee, row.unitId);
    }
    const skippedRows = plan.rows.filter(row => row.status === "ERROR" || row.status === "REVIEW");
    return { createdCount: plan.counts.CREATE, alreadyAssignedCount: plan.counts.ALREADY_ASSIGNED,
      skippedCount: skippedRows.length, skippedRows };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 });
}
