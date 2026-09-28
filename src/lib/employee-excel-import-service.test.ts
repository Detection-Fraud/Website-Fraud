import assert from "node:assert/strict";
import { before, beforeEach, it, mock } from "node:test";
import ExcelJS from "exceljs";
import { PENTAHO_EMPLOYEE_HEADERS } from "@/lib/pentaho-employee-adapter";

type PreviewRecord = Record<string, unknown> & { id: string; tokenHash: string; initiatedById: string; consumedAt: Date | null };
let state: {
  preview: PreviewRecord | null;
  baseline: string | null;
  active: { id: string; channel: string } | null;
  runCreates: number;
  employeeWrites: number;
  userWrites: number;
};

const tx = {
  $queryRaw: async () => [{ lockAcquired: true }],
  employeeSyncRun: { findFirst: async () => state.baseline ? { id: state.baseline } : null },
  employeeImportPreview: {
    updateMany: async ({ where, data }: { where: { id: string; tokenHash: string; initiatedById: string }; data: { consumedAt: Date } }) => {
      const record = state.preview;
      if (!record || record.id !== where.id || record.tokenHash !== where.tokenHash || record.initiatedById !== where.initiatedById || record.consumedAt) return { count: 0 };
      record.consumedAt = data.consumedAt;
      return { count: 1 };
    },
  },
};

const prisma = {
  $transaction: async <T>(callback: (client: typeof tx) => Promise<T>): Promise<T> => {
    const consumedBefore = state.preview?.consumedAt ?? null;
    try {
      const result = await callback(tx);
      return result;
    } catch (error) {
      if (state.preview) state.preview.consumedAt = consumedBefore;
      throw error;
    }
  },
  employeeImportPreview: {
    findMany: async () => [],
    deleteMany: async () => ({ count: 0 }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      state.preview = { ...data, id: "preview-1", tokenHash: String(data.tokenHash), initiatedById: String(data.initiatedById), consumedAt: null };
      return state.preview;
    },
    findFirst: async ({ where }: { where: { tokenHash: string; initiatedById: string } }) =>
      state.preview?.tokenHash === where.tokenHash && state.preview.initiatedById === where.initiatedById ? state.preview : null,
  },
  employeeSyncRun: {
    findFirst: async ({ where }: { where: { status: string } }) => where.status === "RUNNING" ? state.active : (state.baseline ? { id: state.baseline } : null),
    create: async () => { state.runCreates += 1; return { id: "run-excel-1" }; },
  },
  employee: { updateMany: async () => { state.employeeWrites += 1; } },
  user: { updateMany: async () => { state.userWrites += 1; } },
};

const inspection = mock.fn(async () => ({
  impactHash: "impact-1",
  newCount: 1,
  changedCount: 0,
  unchangedCount: 0,
  missingCount: 0,
  deactivationCount: 0,
  details: [{ nip: "001234", change: "NEW" as const }],
}));
let service: typeof import("./employee-excel-import");
let failAfterGuard = false;

mock.module("@/lib/prisma", { namedExports: { prisma } });
mock.module("@/lib/employee-sync", {
  namedExports: {
    EmployeeSnapshotValidationError: class EmployeeSnapshotValidationError extends Error {},
    inspectEmployeeSnapshotForPreview: inspection,
    recoverExpiredEmployeeExcelRuns: async () => {},
    syncEmployeeSnapshotForRun: async (runId: string, _snapshot: unknown, options: { transactionGuard?: (client: typeof tx) => Promise<void> }) => {
      await prisma.$transaction(async (client) => {
        await options.transactionGuard?.(client);
        if (failAfterGuard) throw new Error("synthetic reconciliation failure");
      });
      return { runId, receivedCount: 1, processedCount: 1, missingCount: 0, deactivatedCount: 0 };
    },
  },
});

before(async () => { service = await import("./employee-excel-import"); });
beforeEach(() => {
  state = { preview: null, baseline: "baseline-1", active: null, runCreates: 0, employeeWrites: 0, userWrites: 0 };
  failAfterGuard = false;
  inspection.mock.mockImplementation(async () => ({
    impactHash: "impact-1", newCount: 1, changedCount: 0, unchangedCount: 0, missingCount: 0, deactivationCount: 0,
    details: [{ nip: "001234", change: "NEW" as const }],
  }));
});

async function workbook(name = "Nama Pegawai"): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Karyawan");
  const excelHeaders = PENTAHO_EMPLOYEE_HEADERS.slice(0, 14);
  sheet.addRow([...excelHeaders]);
  const row: Record<string, string> = {
    NIP: "001234", NAMA: name, JAB_LKP: "Jabatan", KODE_STATPEG: "01", STAT_KEPEG: "02",
    KODE_DOLOG: "00", KODE_SUBDOLOG: "00", KODE_KANSILOG: "00", KODE_GUDANG: "000000", KODE_ORG: "E00000",
    JENJANG: "4. Jenjang III", NAMA_ORG: "Perum Bulog", NAMA_SATKER: "Kantor Pusat", NAMA_INDUK: "",
  };
  sheet.addRow(excelHeaders.map((header) => row[header]!));
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function preview(): Promise<{ bytes: Buffer; token: string }> {
  const bytes = await workbook();
  const result = await service.previewEmployeeImport("admin-1", "staff.xlsx", bytes);
  return { bytes, token: result.previewToken };
}

it("previews read-only and stores only Admin/file/baseline/impact hashes", async () => {
  const { bytes, token } = await preview();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(state.preview?.initiatedById, "admin-1");
  assert.equal(state.preview?.fileHash, (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex"));
  assert.notEqual(state.preview?.tokenHash, token);
  assert.equal(state.preview?.baselineRunId, "baseline-1");
  assert.equal(state.preview?.impactHash, "impact-1");
  assert.equal(state.runCreates, 0);
  assert.equal(state.employeeWrites, 0);
  assert.equal(state.userWrites, 0);
});

it("binds preview lookup to the initiating Admin and exact uploaded bytes", async () => {
  const { token } = await preview();
  await assert.rejects(service.commitEmployeeImport("admin-2", token, "staff.xlsx", await workbook()), { code: "PREVIEW_INVALID" });
  await assert.rejects(service.commitEmployeeImport("admin-1", token, "staff.xlsx", await workbook("Changed file")), { code: "FILE_MISMATCH" });
  assert.equal(state.employeeWrites, 0);
  assert.equal(state.userWrites, 0);
});

it("rejects expired and replayed tokens", async () => {
  const { bytes, token } = await preview();
  state.preview!.expiresAt = new Date(Date.now() - 1);
  await assert.rejects(service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes), { code: "PREVIEW_EXPIRED" });
  state.preview!.expiresAt = new Date(Date.now() + 60_000);
  state.preview!.consumedAt = new Date();
  await assert.rejects(service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes), { code: "PREVIEW_REPLAYED" });
});

it("rechecks baseline and canonical impact inside the reconciliation guard", async () => {
  const { bytes, token } = await preview();
  state.baseline = "baseline-2";
  await assert.rejects(service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes), { code: "STALE_BASELINE" });
  state.baseline = "baseline-1";
  inspection.mock.mockImplementationOnce(async () => ({
    impactHash: "impact-2", newCount: 0, changedCount: 1, unchangedCount: 0, missingCount: 0, deactivationCount: 0, details: [],
  }));
  await assert.rejects(service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes), { code: "IMPACT_CHANGED" });
  assert.equal(state.preview?.consumedAt, null);
  assert.equal(state.employeeWrites, 0);
  assert.equal(state.userWrites, 0);
});

it("blocks a running Pentaho run before creating an Excel run", async () => {
  const { bytes, token } = await preview();
  state.active = { id: "pentaho-running", channel: "PENTAHO" };
  await assert.rejects(service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes), { code: "ACTIVE_RUN" });
  assert.equal(state.runCreates, 0);
});

it("consumes the preview in the reconciliation transaction and returns only safe success fields", async () => {
  const { bytes, token } = await preview();
  const result = await service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes);
  assert.deepEqual(result, {
    runId: "run-excel-1", sourceSystem: "PENTAHO", channel: "EXCEL_IMPORT", status: "SUCCEEDED",
    receivedCount: 1, processedCount: 1, missingCount: 0, deactivatedCount: 0,
  });
  assert.ok(state.preview?.consumedAt instanceof Date);
  assert.equal(state.employeeWrites, 0);
  assert.equal(state.userWrites, 0);
  await assert.rejects(service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes), { code: "PREVIEW_REPLAYED" });
});

it("rolls token consumption back and sanitizes a reconciliation failure", async () => {
  const { bytes, token } = await preview();
  failAfterGuard = true;
  await assert.rejects(service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes), { code: "COMMIT_FAILED" });
  assert.equal(state.preview?.consumedAt, null);
  assert.equal(state.employeeWrites, 0);
  assert.equal(state.userWrites, 0);
});
