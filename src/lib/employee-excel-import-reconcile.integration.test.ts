import assert from "node:assert/strict";
import { before, beforeEach, it, mock } from "node:test";
import ExcelJS from "exceljs";
import { Prisma } from "@generated/prisma/client";
import { PENTAHO_EMPLOYEE_HEADERS } from "@/lib/pentaho-employee-adapter";

type Employee = Record<string, any> & { id: string; nip: string; isPresentInSource: boolean; unitId: string | null };
type User = { id: string; employeeId: string | null; role: "ADMIN" | "PIC" | "VIEWER"; authProvider: string; isActive: boolean; unitId: string | null };
type Run = Record<string, any> & { id: string; sourceSystem: string; status: string; phase: string | null; startedAt: Date };

const state: {
  employees: Employee[];
  users: User[];
  runs: Run[];
  previews: Array<Record<string, any>>;
  mappings: Array<{ externalUnitCode: string; unitId: string; unit: { id: string } }>;
  sequence: number;
  failUpsert: boolean;
  runCreateBarrier: (() => Promise<void>) | null;
  runCreateArrivals: number;
  releaseRunCreateBarrier: (() => void) | null;
  lockAcquired: boolean;
} = { employees: [], users: [], runs: [], previews: [], mappings: [], sequence: 0, failUpsert: false, runCreateBarrier: null, runCreateArrivals: 0, releaseRunCreateBarrier: null, lockAcquired: true };

const now = () => new Date("2026-09-28T00:00:00.000Z");
const cloneState = () => structuredClone({ employees: state.employees, users: state.users, runs: state.runs, previews: state.previews, sequence: state.sequence });
const restoreState = (saved: ReturnType<typeof cloneState>) => Object.assign(state, saved);

function relatedUser(employeeId: string) { return state.users.find((user) => user.employeeId === employeeId) ?? null; }

function txClient() {
  return {
    $queryRaw: async () => [{ locked: state.lockAcquired, lockAcquired: state.lockAcquired }],
    employeeSyncRun: {
      findFirst: async ({ where }: any) => where.completedAt ? null : [...state.runs].reverse().find((run) => run.sourceSystem === where.sourceSystem && run.status === "SUCCEEDED") ?? null,
      updateMany: async ({ where, data }: any) => {
        const matches = state.runs.filter((item) =>
          (where.id === undefined || item.id === where.id)
          && (where.sourceSystem === undefined || item.sourceSystem === where.sourceSystem)
          && (where.channel === undefined || item.channel === where.channel)
          && (where.status === undefined || item.status === where.status)
          && (where.phase?.in ? where.phase.in.includes(item.phase) : where.phase === undefined || item.phase === where.phase)
          && (where.deadlineAt?.lte === undefined || (item.deadlineAt instanceof Date && item.deadlineAt <= where.deadlineAt.lte)),
        );
        for (const run of matches) Object.assign(run, data);
        return { count: matches.length };
      },
      update: async ({ where, data }: any) => {
        const run = state.runs.find((item) => item.id === where.id);
        if (run) Object.assign(run, data);
        return run;
      },
    },
    employeeImportPreview: {
      updateMany: async ({ where, data }: any) => {
        const preview = state.previews.find((item) => item.id === where.id && item.tokenHash === where.tokenHash && item.initiatedById === where.initiatedById && item.fileHash === where.fileHash && item.baselineRunId === where.baselineRunId && item.impactHash === where.impactHash && item.consumedAt === null && item.expiresAt > where.expiresAt.gt);
        if (!preview) return { count: 0 };
        Object.assign(preview, data);
        return { count: 1 };
      },
    },
    unitExternalMapping: {
      findMany: async ({ where }: any) => state.mappings.filter((item) => item.externalUnitCode && where.externalUnitCode.in.includes(item.externalUnitCode)),
    },
    employee: {
      findMany: async ({ where }: any) => {
        let rows = state.employees;
        if (where.nip?.in) rows = rows.filter((row) => where.nip.in.includes(row.nip));
        if (where.nip?.notIn) rows = rows.filter((row) => !where.nip.notIn.includes(row.nip));
        if (where.isPresentInSource !== undefined) rows = rows.filter((row) => row.isPresentInSource === where.isPresentInSource);
        return rows.map((row) => ({ ...row, user: relatedUser(row.id) }));
      },
      upsert: async ({ where, create, update }: any) => {
        if (state.failUpsert) throw new Error("injected employee write failure");
        const old = state.employees.find((row) => row.nip === where.nip);
        if (old) { Object.assign(old, update, { updatedAt: now() }); return old; }
        const employee = { id: `employee-${state.employees.length + 1}`, createdAt: now(), updatedAt: now(), ...create };
        state.employees.push(employee);
        return employee;
      },
      updateMany: async ({ where, data }: any) => {
        const ids: string[] = where.id.in;
        const matches = state.employees.filter((row) => ids.includes(row.id));
        for (const row of matches) Object.assign(row, data);
        return { count: matches.length };
      },
    },
    user: {
      updateMany: async ({ where, data }: any) => {
        const matches = state.users.filter((user) => {
          if (where.id?.in && !where.id.in.includes(user.id)) return false;
          if (where.employeeId?.in && !where.employeeId.in.includes(user.employeeId)) return false;
          if (where.authProvider && where.authProvider !== user.authProvider) return false;
          if (where.isActive !== undefined && where.isActive !== user.isActive) return false;
          return true;
        });
        for (const user of matches) Object.assign(user, data);
        return { count: matches.length };
      },
    },
  };
}

const prisma = {
  $transaction: async (callback: (tx: ReturnType<typeof txClient>) => Promise<unknown>) => {
    const saved = cloneState();
    try { return await callback(txClient()); }
    catch (error) { restoreState(saved); throw error; }
  },
  employeeImportPreview: {
    findMany: async () => [], deleteMany: async () => ({ count: 0 }),
    create: async ({ data }: any) => { const row = { id: `preview-${state.previews.length + 1}`, consumedAt: null, ...data }; state.previews.push(row); return row; },
    findFirst: async ({ where }: any) => state.previews.find((row) => row.tokenHash === where.tokenHash && row.initiatedById === where.initiatedById) ?? null,
  },
  employeeSyncRun: {
    findFirst: async ({ where }: any) => where.status === "RUNNING"
      ? state.runs.find((run) => run.sourceSystem === where.sourceSystem && run.status === "RUNNING") ?? null
      : [...state.runs].reverse().find((run) => run.sourceSystem === where.sourceSystem && run.status === "SUCCEEDED") ?? null,
    findUnique: async ({ where }: any) => {
      const run = state.runs.find((item) => item.id === where.id);
      return run ? { id: run.id, sourceSystem: run.sourceSystem, status: run.status, phase: run.phase, channel: run.channel, startedAt: run.startedAt } : null;
    },
    create: async ({ data }: any) => {
      if (state.runCreateBarrier) {
        state.runCreateArrivals += 1;
        if (state.runCreateArrivals === 2) state.releaseRunCreateBarrier?.();
        await state.runCreateBarrier();
      }
      if (state.runs.some((run) => run.sourceSystem === data.sourceSystem && run.status === "RUNNING")) {
        throw new Prisma.PrismaClientKnownRequestError("active source run unique constraint", { code: "P2002", clientVersion: "test" });
      }
      const run = { id: `run-${++state.sequence}`, startedAt: now(), ...data } as Run;
      state.runs.push(run);
      return { id: run.id, startedAt: run.startedAt };
    },
    updateMany: async ({ where, data }: any) => {
      const matches = state.runs.filter((run) => run.id === where.id && run.status === where.status && (!where.OR || where.OR.some((condition: any) => condition.phase === null ? run.phase === null : run.phase === condition.phase)));
      for (const run of matches) Object.assign(run, data);
      return { count: matches.length };
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma } });
let service: typeof import("./employee-excel-import");
let realReconciler: typeof import("./employee-sync");
before(async () => {
  realReconciler = await import("./employee-sync");
  service = await import("./employee-excel-import");
});
beforeEach(() => {
  state.employees = [];
  state.users = [];
  state.runs = [];
  state.previews = [];
  state.mappings = [{ externalUnitCode: "DIVISI:E00000", unitId: "unit-division", unit: { id: "unit-division" } }];
  state.sequence = 0;
  state.failUpsert = false;
  state.runCreateBarrier = null;
  state.runCreateArrivals = 0;
  state.releaseRunCreateBarrier = null;
  state.lockAcquired = true;
});

async function workbook(nip = "001234"): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Karyawan");
  sheet.addRow(PENTAHO_EMPLOYEE_HEADERS.slice(0, 14));
  sheet.addRow([nip, "Nama Pegawai", "Jabatan", "01", "02", "00", "00", "00", "000000", "E00000", "4. Jenjang III", "Perum Bulog", "Kantor Pusat", ""]);
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function preview(bytes: Buffer) { return service.previewEmployeeImport("admin-1", "staff.xlsx", bytes); }
async function commit(bytes: Buffer, token: string) { return service.commitEmployeeImport("admin-1", token, "staff.xlsx", bytes); }

it("uses the real adapter and reconciler to reject a missing Unit mapping before preview persistence", async () => {
  state.mappings = [];
  await assert.rejects(preview(await workbook()), { code: "INVALID_SNAPSHOT" });
  assert.equal(state.previews.length, 0);
  assert.equal(state.employees.length, 0);
  assert.equal(state.users.length, 0);
  assert.equal(state.runs.length, 0);
});

it("applies the Excel snapshot through the real reconciler and its Employee/User effects", async () => {
  assert.equal(typeof realReconciler.syncEmployeeSnapshotForRun, "function");
  state.employees.push({ id: "employee-missing", nip: "OLD", name: "Old", jobTitle: null, jenjang: "4", jenjangLabel: "4. Jenjang III", kodeStatpeg: "01", statKepeg: "02", sourceKodeDolog: "00", sourceKodeSubdolog: "00", sourceKodeKansilog: "00", sourceKodeGudang: "000000", sourceKodeOrg: "E00000", sourceNamaOrg: "Perum Bulog", sourceNamaSatker: "Kantor Pusat", sourceNamaInduk: null, sourceCreatedAt: now(), sourceCreatedBy: "Pentaho", sourceUpdatedAt: now(), sourceUpdatedBy: "Pentaho", unitId: "unit-division", isPresentInSource: true, lastSeenAt: null, lastSeenSyncRunId: null, createdAt: now(), updatedAt: now() });
  state.users.push({ id: "user-pic", employeeId: "employee-missing", role: "PIC", authProvider: "SSO", isActive: true, unitId: "unit-division" });
  const bytes = await workbook();
  const previewResult = await preview(bytes);
  const result = await commit(bytes, previewResult.previewToken);
  assert.equal(result.channel, "EXCEL_IMPORT");
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(result.processedCount, 1);
  assert.equal(result.missingCount, 1);
  assert.equal(result.deactivatedCount, 1);
  const imported = state.employees.find((row) => row.nip === "001234");
  const missing = state.employees.find((row) => row.nip === "OLD");
  assert.equal(imported?.unitId, "unit-division");
  assert.equal(imported?.isPresentInSource, true);
  assert.equal(imported?.sourceCreatedBy, "Excel Import");
  assert.equal(imported?.sourceUpdatedBy, "Excel Import");
  assert.ok(imported?.sourceCreatedAt instanceof Date);
  assert.equal(imported?.sourceCreatedAt?.getTime(), imported?.sourceUpdatedAt?.getTime());
  assert.equal(missing?.isPresentInSource, false);
  assert.equal(state.users[0]?.isActive, false);
  assert.equal(state.users[0]?.role, "PIC");
  assert.equal(state.users[0]?.unitId, "unit-division");
  assert.equal(state.runs.length, 1);
  assert.equal(state.runs[0]?.channel, "EXCEL_IMPORT");
  assert.equal(state.runs[0]?.status, "SUCCEEDED");
});

it("keeps Excel metadata unchanged for no-op rows, including legacy null creation metadata", async () => {
  const originalUpdatedAt = new Date("2025-01-01T00:00:00.000Z");
  state.employees.push({
    id: "employee-existing", nip: "001234", name: "Nama Pegawai", jobTitle: "Jabatan", jenjang: "4",
    jenjangLabel: "4. Jenjang III", kodeStatpeg: "01", statKepeg: "02", sourceKodeDolog: "00",
    sourceKodeSubdolog: "00", sourceKodeKansilog: "00", sourceKodeGudang: "000000", sourceKodeOrg: "E00000",
    sourceNamaOrg: "Perum Bulog", sourceNamaSatker: "Kantor Pusat", sourceNamaInduk: null,
    sourceCreatedAt: null, sourceCreatedBy: null, sourceUpdatedAt: originalUpdatedAt, sourceUpdatedBy: "Old System",
    unitId: "unit-division", isPresentInSource: true, lastSeenAt: null, lastSeenSyncRunId: null,
    createdAt: now(), updatedAt: now(),
  });
  const bytes = await workbook();
  const previewResult = await preview(bytes);
  assert.equal(previewResult.impact.unchangedCount, 1);
  assert.equal(previewResult.impact.changedCount, 0);
  await commit(bytes, previewResult.previewToken);
  const imported = state.employees[0];
  assert.equal(imported?.sourceCreatedAt, null);
  assert.equal(imported?.sourceCreatedBy, null);
  assert.equal(imported?.sourceUpdatedAt?.getTime(), originalUpdatedAt.getTime());
  assert.equal(imported?.sourceUpdatedBy, "Old System");
});

it("preserves created metadata and advances updated metadata for changed Excel rows", async () => {
  const originalCreatedAt = new Date("2024-01-01T00:00:00.000Z");
  const originalUpdatedAt = new Date("2025-01-01T00:00:00.000Z");
  state.employees.push({
    id: "employee-existing", nip: "001234", name: "Nama Sebelumnya", jobTitle: "Jabatan", jenjang: "4",
    jenjangLabel: "4. Jenjang III", kodeStatpeg: "01", statKepeg: "02", sourceKodeDolog: "00",
    sourceKodeSubdolog: "00", sourceKodeKansilog: "00", sourceKodeGudang: "000000", sourceKodeOrg: "E00000",
    sourceNamaOrg: "Perum Bulog", sourceNamaSatker: "Kantor Pusat", sourceNamaInduk: null,
    sourceCreatedAt: originalCreatedAt, sourceCreatedBy: "Original Creator", sourceUpdatedAt: originalUpdatedAt,
    sourceUpdatedBy: "Previous Editor", unitId: "unit-division", isPresentInSource: true,
    lastSeenAt: null, lastSeenSyncRunId: null, createdAt: now(), updatedAt: now(),
  });
  const bytes = await workbook();
  const previewResult = await preview(bytes);
  assert.equal(previewResult.impact.changedCount, 1);
  await commit(bytes, previewResult.previewToken);
  const imported = state.employees[0];
  assert.equal(imported?.sourceCreatedAt?.getTime(), originalCreatedAt.getTime());
  assert.equal(imported?.sourceCreatedBy, "Original Creator");
  assert.ok(imported?.sourceUpdatedAt instanceof Date);
  assert.ok(imported.sourceUpdatedAt.getTime() > originalUpdatedAt.getTime());
  assert.equal(imported?.sourceUpdatedBy, "Excel Import");
});

it("updates last-change metadata when an Excel snapshot makes an Employee reappear", async () => {
  const originalCreatedAt = new Date("2024-01-01T00:00:00.000Z");
  const originalUpdatedAt = new Date("2025-01-01T00:00:00.000Z");
  state.employees.push({
    id: "employee-returning", nip: "001234", name: "Nama Pegawai", jobTitle: "Jabatan", jenjang: "4",
    jenjangLabel: "4. Jenjang III", kodeStatpeg: "01", statKepeg: "02", sourceKodeDolog: "00",
    sourceKodeSubdolog: "00", sourceKodeKansilog: "00", sourceKodeGudang: "000000", sourceKodeOrg: "E00000",
    sourceNamaOrg: "Perum Bulog", sourceNamaSatker: "Kantor Pusat", sourceNamaInduk: null,
    sourceCreatedAt: originalCreatedAt, sourceCreatedBy: "Original Creator", sourceUpdatedAt: originalUpdatedAt,
    sourceUpdatedBy: "Previous Editor", unitId: "unit-division", isPresentInSource: false,
    lastSeenAt: null, lastSeenSyncRunId: null, createdAt: now(), updatedAt: now(),
  });
  const bytes = await workbook();
  const previewResult = await preview(bytes);
  assert.equal(previewResult.impact.changedCount, 1);
  await commit(bytes, previewResult.previewToken);
  const imported = state.employees[0];
  const completedRun = state.runs.find((run) => run.status === "SUCCEEDED");
  assert.equal(imported?.isPresentInSource, true);
  assert.equal(imported?.sourceCreatedAt?.getTime(), originalCreatedAt.getTime());
  assert.equal(imported?.sourceCreatedBy, "Original Creator");
  assert.equal(imported?.sourceUpdatedBy, "Excel Import");
  assert.equal(imported?.sourceUpdatedAt?.getTime(), completedRun?.completedAt?.getTime());
});

it("rolls back Employee/User writes and preview consumption on a real reconciler write failure", async () => {
  state.employees.push({ id: "employee-missing", nip: "OLD", name: "Old", jobTitle: null, jenjang: "4", jenjangLabel: "4. Jenjang III", kodeStatpeg: "01", statKepeg: "02", sourceKodeDolog: "00", sourceKodeSubdolog: "00", sourceKodeKansilog: "00", sourceKodeGudang: "000000", sourceKodeOrg: "E00000", sourceNamaOrg: "Perum Bulog", sourceNamaSatker: "Kantor Pusat", sourceNamaInduk: null, sourceCreatedAt: now(), sourceCreatedBy: "Pentaho", sourceUpdatedAt: now(), sourceUpdatedBy: "Pentaho", unitId: "unit-division", isPresentInSource: true, lastSeenAt: null, lastSeenSyncRunId: null, createdAt: now(), updatedAt: now() });
  state.users.push({ id: "user-pic", employeeId: "employee-missing", role: "PIC", authProvider: "SSO", isActive: true, unitId: "unit-division" });
  const bytes = await workbook();
  const previewResult = await preview(bytes);
  state.failUpsert = true;
  await assert.rejects(commit(bytes, previewResult.previewToken), { code: "COMMIT_FAILED" });
  assert.equal(state.employees.length, 1);
  assert.equal(state.employees[0]?.isPresentInSource, true);
  assert.equal(state.users[0]?.isActive, true);
  assert.equal(state.previews[0]?.consumedAt, null);
  assert.equal(state.runs[0]?.status, "FAILED");
});

it("rejects an already-active Pentaho source run without creating an Excel run", async () => {
  const bytes = await workbook();
  const previewResult = await preview(bytes);
  state.runs.push({ id: "pentaho-running", sourceSystem: "PENTAHO", channel: "PENTAHO", status: "RUNNING", phase: "PENTAHO_RUNNING", startedAt: now() });
  await assert.rejects(commit(bytes, previewResult.previewToken), { code: "ACTIVE_RUN" });
  assert.equal(state.runs.length, 1);
  assert.equal(state.employees.length, 0);
});

it("fails crashed Excel VALIDATING and RECONCILING runs after their deadline and remains idempotent", async () => {
  for (const [index, phase] of ["VALIDATING", "RECONCILING"].entries()) {
    state.runs.push({
      id: `expired-${index}`, sourceSystem: "PENTAHO", channel: "EXCEL_IMPORT", status: "RUNNING", phase,
      startedAt: now(), deadlineAt: new Date(now().getTime() - 1), receivedCount: 1,
      processedCount: 1, missingCount: 1, deactivatedCount: 1,
    });
  }
  await realReconciler.recoverExpiredEmployeeExcelRuns(now());
  await realReconciler.recoverExpiredEmployeeExcelRuns(now());
  assert.deepEqual(state.runs.map(({ status, phase, errorMessage, processedCount, missingCount, deactivatedCount }) =>
    ({ status, phase, errorMessage, processedCount, missingCount, deactivatedCount })), [
    { status: "FAILED", phase: "COMPLETED", errorMessage: "EMPLOYEE_IMPORT_DEADLINE_EXCEEDED", processedCount: 0, missingCount: 0, deactivatedCount: 0 },
    { status: "FAILED", phase: "COMPLETED", errorMessage: "EMPLOYEE_IMPORT_DEADLINE_EXCEEDED", processedCount: 0, missingCount: 0, deactivatedCount: 0 },
  ]);
});

it("leaves an expired Excel run active when reconciliation owns the source lock", async () => {
  state.lockAcquired = false;
  const active = { id: "expired", sourceSystem: "PENTAHO", channel: "EXCEL_IMPORT", status: "RUNNING", phase: "RECONCILING", startedAt: now(), deadlineAt: new Date(now().getTime() - 1), processedCount: 0, missingCount: 0, deactivatedCount: 0 };
  state.runs.push(active);
  await realReconciler.recoverExpiredEmployeeExcelRuns(now());
  assert.equal(state.runs[0]?.status, "RUNNING");
});

it("allows only one of two simultaneous commits to create/reconcile a run", async () => {
  const bytes = await workbook();
  const previewResult = await preview(bytes);
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  state.runCreateBarrier = async () => barrier;
  state.releaseRunCreateBarrier = release;
  const attempts = await Promise.allSettled([commit(bytes, previewResult.previewToken), commit(bytes, previewResult.previewToken)]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
  const rejected = attempts.find((attempt) => attempt.status === "rejected");
  assert.equal((rejected as PromiseRejectedResult).reason.code, "CONCURRENT_RUN");
  assert.equal(state.runs.filter((run) => run.status === "SUCCEEDED").length, 1);
  assert.equal(state.runs.length, 1);
  assert.equal(state.employees.filter((row) => row.nip === "001234").length, 1);
  assert.ok(state.previews[0]?.consumedAt instanceof Date);
  await assert.rejects(commit(bytes, previewResult.previewToken), { code: "PREVIEW_REPLAYED" });
});
