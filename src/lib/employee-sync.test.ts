import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { prisma } from "@/lib/prisma";
import { parseEmployeeSnapshot } from "./employee-sync-contract";
import type { ExistingEmployeeForSync } from "./employee-sync";

type TestUser = {
  id: string;
  employeeId: string | null;
  role: "ADMIN" | "PIC" | "VIEWER";
  authProvider: string;
  isActive: boolean;
  unitId: string | null;
};

type TestEmployee = Record<string, unknown> & {
  id: string;
  nip: string;
  name: string;
  jobTitle: string | null;
  jenjang: string;
  jenjangLabel: string | null;
  kodeStatpeg: string;
  statKepeg: string;
  sourceKodeDolog: string | null;
  sourceKodeSubdolog: string | null;
  sourceKodeKansilog: string | null;
  sourceKodeGudang: string | null;
  sourceKodeOrg: string | null;
  sourceNamaOrg: string | null;
  sourceNamaSatker: string | null;
  sourceNamaInduk: string | null;
  sourceCreatedAt: Date | null;
  sourceCreatedBy: string | null;
  sourceUpdatedAt: Date | null;
  sourceUpdatedBy: string | null;
  unitId: string | null;
  isPresentInSource: boolean;
  lastSeenAt: Date | null;
  lastSeenSyncRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TestMapping = {
  externalUnitCode: string;
  unitId: string;
  unit: { id: string };
};

type TestState = {
  employees: TestEmployee[];
  users: TestUser[];
  mappings: TestMapping[];
  runs: Array<Record<string, unknown>>;
  runSequence: number;
  mappingQueries: number;
  lockQueries: number;
  upsertCount: number;
  failOnUpsertNumber: number | null;
  newerSuccessfulRun: { id: string } | null;
};

const state: TestState = {
  employees: [],
  users: [],
  mappings: [],
  runs: [],
  runSequence: 0,
  mappingQueries: 0,
  lockQueries: 0,
  upsertCount: 0,
  failOnUpsertNumber: null,
  newerSuccessfulRun: null,
};

const runCreateMock = mock.fn(async (args: any) => {
  const id = `run-${++state.runSequence}`;
  const startedAt = new Date("2026-09-16T00:00:00.000Z");
  const run = { id, startedAt, ...args.data };
  state.runs.push(run);
  return { id, startedAt };
});

const runUpdateMock = mock.fn(async (args: any) => {
  const run = state.runs.find((candidate) => candidate.id === args.where.id);
  if (run) Object.assign(run, args.data);
  return run ?? { id: args.where.id };
});

const runFindUniqueMock = mock.fn(async (args: any) => {
  const run = state.runs.find((candidate) => candidate.id === args.where.id);
  if (!run) return null;

  return {
    id: run.id,
    sourceSystem: run.sourceSystem,
    status: run.status,
    phase: run.phase ?? null,
    channel: run.channel ?? "PENTAHO",
    startedAt: run.startedAt,
  };
});

const runUpdateManyMock = mock.fn(async (args: any) => {
  const matches = state.runs.filter(
    (candidate) =>
      candidate.id === args.where.id &&
      candidate.status === args.where.status &&
      (!args.where.OR ||
        args.where.OR.some((condition: any) =>
          condition.phase === null
            ? candidate.phase == null
            : candidate.phase === condition.phase,
        )),
  );
  for (const run of matches) Object.assign(run, args.data);
  return { count: matches.length };
});

function createTransactionDouble() {
  return {
    $queryRaw: async () => {
      state.lockQueries += 1;
      return [];
    },
    employeeSyncRun: {
      findFirst: async () => state.newerSuccessfulRun,
      update: runUpdateMock,
      updateMany: runUpdateManyMock,
    },
    unitExternalMapping: {
      findMany: async () => {
        state.mappingQueries += 1;
        return state.mappings;
      },
    },
    employee: {
      findMany: async (args: any) => {
        let result = state.employees;

        if (args.where?.nip?.in) {
          result = result.filter((employee) => args.where.nip.in.includes(employee.nip));
        }

        if (args.where?.nip?.notIn) {
          result = result.filter((employee) => !args.where.nip.notIn.includes(employee.nip));
        }

        if (args.where?.isPresentInSource !== undefined) {
          result = result.filter(
            (employee) => employee.isPresentInSource === args.where.isPresentInSource,
          );
        }

        return result.map((employee) => ({
          ...employee,
          user: state.users.find((user) => user.employeeId === employee.id) ?? null,
        }));
      },
      upsert: async (args: any) => {
        state.upsertCount += 1;

        if (
          state.failOnUpsertNumber !== null &&
          state.upsertCount === state.failOnUpsertNumber
        ) {
          throw new Error("injected employee write failure");
        }

        const existing = state.employees.find(
          (employee) => employee.nip === args.where.nip,
        );

        if (existing) {
          Object.assign(existing, args.update, { updatedAt: new Date() });
          return existing;
        }

        const now = new Date();
        const created = {
          id: `employee-${state.employees.length + 1}`,
          createdAt: now,
          updatedAt: now,
          ...args.create,
        } as TestEmployee;
        state.employees.push(created);
        return created;
      },
      updateMany: async (args: any) => {
        const ids = args.where.id.in as string[];
        const matches = state.employees.filter((employee) => ids.includes(employee.id));
        for (const employee of matches) Object.assign(employee, args.data);
        return { count: matches.length };
      },
    },
    user: {
      updateMany: async (args: any) => {
        const ids = args.where.id?.in as string[] | undefined;
        const employeeIds = args.where.employeeId?.in as string[] | undefined;
        const matches = state.users.filter((user) => {
          if (ids && !ids.includes(user.id)) return false;
          if (employeeIds && !employeeIds.includes(user.employeeId ?? "")) return false;
          if (args.where.authProvider && user.authProvider !== args.where.authProvider) return false;
          if (args.where.isActive !== undefined && user.isActive !== args.where.isActive) return false;
          return true;
        });
        for (const user of matches) Object.assign(user, args.data);
        return { count: matches.length };
      },
    },
  };
}

const transactionMock = mock.fn(async (callback: any) => {
  const before = structuredClone(state);

  try {
    return await callback(createTransactionDouble());
  } catch (error) {
    // Database state rolls back; test-observation counters must remain so a
    // failing transaction can still prove which guards were reached.
    const observedCounters = {
      lockQueries: state.lockQueries,
      mappingQueries: state.mappingQueries,
      upsertCount: state.upsertCount,
    };
    Object.assign(state, before);
    Object.assign(state, observedCounters);
    throw error;
  }
});

// Prisma's generated delegates are proxy-backed: Node's mock.method cannot
// inspect them as ordinary methods. Replace only the delegates used by this
// isolated test double with plain, configurable objects.
Object.defineProperty(prisma, "employeeSyncRun", {
  configurable: true,
  value: {
    create: runCreateMock,
    update: runUpdateMock,
    updateMany: runUpdateManyMock,
    findUnique: runFindUniqueMock,
  },
  writable: true,
});
Object.defineProperty(prisma, "$transaction", {
  configurable: true,
  value: transactionMock,
  writable: true,
});

let shouldDeactivateLinkedPicUser: typeof import("./employee-sync").shouldDeactivateLinkedPicUser;
let syncEmployeeSnapshot: typeof import("./employee-sync").syncEmployeeSnapshot;
let syncEmployeeSnapshotForRun: typeof import("./employee-sync").syncEmployeeSnapshotForRun;

before(async () => {
  const employeeSync = await import("./employee-sync");
  shouldDeactivateLinkedPicUser = employeeSync.shouldDeactivateLinkedPicUser;
  syncEmployeeSnapshot = employeeSync.syncEmployeeSnapshot;
  syncEmployeeSnapshotForRun = employeeSync.syncEmployeeSnapshotForRun;
});

function completeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    nip: "123",
    name: "Employee One",
    jobTitle: "Staff",
    jenjang: "5",
    jenjangLabel: "5. Jenjang IV",
    kodeStatpeg: "01",
    statKepeg: "02",
    sourceKodeDolog: "01",
    sourceKodeSubdolog: "00",
    sourceKodeKansilog: "01",
    sourceKodeGudang: "00",
    sourceKodeOrg: "E01000",
    sourceNamaOrg: "KANWIL",
    sourceNamaSatker: "KANWIL",
    sourceNamaInduk: null,
    sourceCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    sourceCreatedBy: "PENTAHO",
    sourceUpdatedAt: new Date("2026-01-02T00:00:00.000Z"),
    sourceUpdatedBy: "PENTAHO",
    externalUnitCode: "UNIT-1",
    ...overrides,
  };
}

function snapshot(...employees: Record<string, unknown>[]) {
  return {
    sourceSystem: "PENTAHO",
    employees: employees.length > 0 ? employees : [completeEmployee()],
  };
}

function mapping(code = "UNIT-1", unitId = "unit-1"): TestMapping {
  return { externalUnitCode: code, unitId, unit: { id: unitId } };
}

function employeeState(overrides: Partial<TestEmployee> = {}): TestEmployee {
  const now = new Date("2025-01-01T00:00:00.000Z");
  return {
    id: "employee-existing",
    nip: "123",
    name: "Legacy Employee",
    jobTitle: "Legacy Job",
    jenjang: "5",
    jenjangLabel: "5. Jenjang IV",
    kodeStatpeg: "01",
    statKepeg: "02",
    sourceKodeDolog: "01",
    sourceKodeSubdolog: "00",
    sourceKodeKansilog: "01",
    sourceKodeGudang: "00",
    sourceKodeOrg: "E01000",
    sourceNamaOrg: "KANWIL",
    sourceNamaSatker: "KANWIL",
    sourceNamaInduk: null,
    sourceCreatedAt: null,
    sourceCreatedBy: null,
    sourceUpdatedAt: null,
    sourceUpdatedBy: null,
    unitId: "unit-1",
    isPresentInSource: true,
    lastSeenAt: null,
    lastSeenSyncRunId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function resetState() {
  state.employees = [];
  state.users = [];
  state.mappings = [mapping()];
  state.runs = [];
  state.runSequence = 0;
  state.mappingQueries = 0;
  state.lockQueries = 0;
  state.upsertCount = 0;
  state.failOnUpsertNumber = null;
  state.newerSuccessfulRun = null;
  runCreateMock.mock.resetCalls();
  runUpdateMock.mock.resetCalls();
  runUpdateManyMock.mock.resetCalls();
  runFindUniqueMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
}

beforeEach(resetState);

describe("canonical employee snapshot contract", () => {
  it("accepts an empty normalized snapshot for trusted orchestration", () => {
    assert.deepEqual(
      parseEmployeeSnapshot({ sourceSystem: "PENTAHO", employees: [] }).employees,
      [],
    );
  });

  it("rejects duplicate NIPs after validating the complete normalized shape", () => {
    assert.throws(
      () =>
        parseEmployeeSnapshot({
          sourceSystem: "PENTAHO",
          employees: [completeEmployee(), completeEmployee({ name: "Duplicate" })],
        }),
      /NIP duplikat/,
    );
  });

  it("rejects non-JSON-compatible source metadata", () => {
    assert.throws(
      () =>
        parseEmployeeSnapshot({
          sourceSystem: "PENTAHO",
          sourceMetadata: { fetchedAt: new Date() },
          employees: [],
        }),
      /sourceMetadata harus berisi nilai JSON yang kompatibel/,
    );
  });
});

describe("atomic Employee snapshot reconciliation", () => {
  it("reuses a pre-created RUNNING run and completes that same run", async () => {
    state.runs.push({
      id: "precreated-run",
      sourceSystem: "PENTAHO",
      status: "RUNNING",
      phase: "VALIDATING",
      startedAt: new Date("2026-09-16T00:00:00.000Z"),
    });

    const result = await syncEmployeeSnapshotForRun(
      "precreated-run",
      snapshot(),
    );

    assert.equal(result.runId, "precreated-run");
    assert.equal(runCreateMock.mock.callCount(), 0);
    assert.equal(state.runs.length, 1);
    assert.equal(state.runs[0].status, "SUCCEEDED");
    assert.equal(state.runs[0].phase, "COMPLETED");
    assert.equal(state.runs[0].receivedCount, 1);
    assert.equal(state.runs[0].processedCount, 1);
  });

  it("rejects a nonexistent pre-created run without creating a replacement", async () => {
    await assert.rejects(() =>
      syncEmployeeSnapshotForRun("missing-run", snapshot()),
    );

    assert.equal(runCreateMock.mock.callCount(), 0);
    assert.equal(runUpdateMock.mock.callCount(), 0);
  });

  it("rejects terminal and already-completed run IDs without changing them", async () => {
    state.runs.push({
      id: "completed-run",
      sourceSystem: "PENTAHO",
      status: "SUCCEEDED",
      phase: "COMPLETED",
      startedAt: new Date("2026-09-16T00:00:00.000Z"),
    });

    await assert.rejects(() =>
      syncEmployeeSnapshotForRun("completed-run", snapshot()),
    );

    assert.equal(state.runs[0].status, "SUCCEEDED");
    assert.equal(state.runs[0].phase, "COMPLETED");
    assert.equal(runUpdateMock.mock.callCount(), 0);
  });

  it("fails a RUNNING run when the snapshot source does not match", async () => {
    state.runs.push({
      id: "wrong-source-run",
      sourceSystem: "PENTAHO",
      status: "RUNNING",
      phase: "PENTAHO_RUNNING",
      startedAt: new Date("2026-09-16T00:00:00.000Z"),
    });

    await assert.rejects(() =>
      syncEmployeeSnapshotForRun(
        "wrong-source-run",
        { ...snapshot(), sourceSystem: "OTHER" },
      ),
    );

    assert.equal(state.runs[0].status, "FAILED");
    assert.equal(state.runs[0].processedCount, 0);
    assert.equal(state.runs[0].missingCount, 0);
    assert.equal(state.runs[0].deactivatedCount, 0);
    assert.equal(String(state.runs[0].errorMessage).includes("123"), false);
  });

  it("requires Excel callers to opt in to the EXCEL_IMPORT channel", async () => {
    state.runs.push({
      id: "excel-run-default-channel-check",
      sourceSystem: "PENTAHO",
      channel: "EXCEL_IMPORT",
      status: "RUNNING",
      phase: "VALIDATING",
      startedAt: new Date("2026-09-16T00:00:00.000Z"),
    });

    await assert.rejects(() =>
      syncEmployeeSnapshotForRun("excel-run-default-channel-check", snapshot()),
    );

    assert.equal(state.runs[0].status, "FAILED");
    assert.equal(state.runs[0].processedCount, 0);
    assert.equal(state.runs[0].errorMessage, "SNAPSHOT_RECONCILIATION_VALIDATION_FAILED");
    assert.equal(transactionMock.mock.callCount(), 0);
    assert.equal(runCreateMock.mock.callCount(), 0);
  });

  it("runs the transaction guard after the source lock and before reconciliation reads", async () => {
    state.runs.push({
      id: "excel-run-guard",
      sourceSystem: "PENTAHO",
      channel: "EXCEL_IMPORT",
      status: "RUNNING",
      phase: "VALIDATING",
      startedAt: new Date("2026-09-16T00:00:00.000Z"),
    });
    const guard = mock.fn(async () => {
      assert.equal(state.lockQueries, 1);
      assert.equal(state.mappingQueries, 0);
      assert.equal(state.upsertCount, 0);
      throw new Error("sensitive preview token details");
    });

    await assert.rejects(() =>
      syncEmployeeSnapshotForRun("excel-run-guard", snapshot(), {
        expectedChannel: "EXCEL_IMPORT",
        transactionGuard: guard,
      }),
    );

    assert.equal(guard.mock.callCount(), 1);
    assert.equal(state.runs[0].status, "FAILED");
    assert.equal(state.runs[0].phase, "RECONCILING");
    assert.equal(state.runs[0].processedCount, 0);
    assert.equal(state.runs[0].missingCount, 0);
    assert.equal(state.runs[0].deactivatedCount, 0);
    assert.equal(state.runs[0].errorMessage, "SNAPSHOT_RECONCILIATION_FAILED");
    assert.equal(String(state.runs[0].errorMessage).includes("sensitive"), false);
    assert.equal(state.employees.length, 0);
    assert.equal(state.users.length, 0);
    assert.equal(runCreateMock.mock.callCount(), 0);
  });

  it("retains RECONCILING phase and zeroes counts when reconciliation fails", async () => {
    state.runs.push({
      id: "failing-run",
      sourceSystem: "PENTAHO",
      status: "RUNNING",
      phase: "VALIDATING",
      startedAt: new Date("2026-09-16T00:00:00.000Z"),
    });
    state.failOnUpsertNumber = 1;

    await assert.rejects(() =>
      syncEmployeeSnapshotForRun("failing-run", snapshot()),
    );

    assert.equal(state.runs[0].status, "FAILED");
    assert.equal(state.runs[0].phase, "RECONCILING");
    assert.equal(state.runs[0].processedCount, 0);
    assert.equal(state.runs[0].missingCount, 0);
    assert.equal(state.runs[0].deactivatedCount, 0);
  });

  it("allows only one concurrent caller to claim and reconcile a pre-created run", async () => {
    state.runs.push({
      id: "concurrent-run",
      sourceSystem: "PENTAHO",
      status: "RUNNING",
      phase: "VALIDATING",
      startedAt: new Date("2026-09-16T00:00:00.000Z"),
      sourceMetadata: { batch: "initial" },
    });

    const [first, second] = await Promise.allSettled([
      syncEmployeeSnapshotForRun(
        "concurrent-run",
        {
          ...snapshot(completeEmployee({ name: "Batch Alpha" })),
          sourceMetadata: { batch: "alpha" },
        },
      ),
      syncEmployeeSnapshotForRun(
        "concurrent-run",
        {
          ...snapshot(completeEmployee({ name: "Batch Beta" })),
          sourceMetadata: { batch: "beta" },
        },
      ),
    ]);

    assert.equal(
      [first, second].filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      [first, second].filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(transactionMock.mock.callCount(), 1);
    assert.equal(state.upsertCount, 1);
    assert.equal(state.runs[0].status, "SUCCEEDED");
    assert.equal(state.runs[0].phase, "COMPLETED");
    assert.ok(["alpha", "beta"].includes((state.runs[0].sourceMetadata as any).batch));
    const sourceMetadata = state.runs[0].sourceMetadata as { batch?: string };
    assert.equal(
      state.employees[0].name,
      sourceMetadata.batch === "alpha" ? "Batch Alpha" : "Batch Beta",
    );
  });

  it("persists all source fields without replacing Prisma lifecycle timestamps", async () => {
    const sourceCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const sourceUpdatedAt = new Date("2026-01-02T00:00:00.000Z");

    await syncEmployeeSnapshot(snapshot(completeEmployee({ sourceCreatedAt, sourceUpdatedAt })));

    const employee = state.employees[0];
    assert.equal(employee.jobTitle, "Staff");
    assert.equal(employee.jenjangLabel, "5. Jenjang IV");
    assert.equal(employee.sourceKodeDolog, "01");
    assert.equal(employee.sourceKodeSubdolog, "00");
    assert.equal(employee.sourceKodeKansilog, "01");
    assert.equal(employee.sourceKodeGudang, "00");
    assert.equal(employee.sourceKodeOrg, "E01000");
    assert.equal(employee.sourceNamaOrg, "KANWIL");
    assert.equal(employee.sourceNamaSatker, "KANWIL");
    assert.equal(employee.sourceNamaInduk, null);
    assert.equal(employee.sourceCreatedAt, sourceCreatedAt);
    assert.equal(employee.sourceUpdatedAt, sourceUpdatedAt);
    assert.equal(employee.sourceCreatedBy, "PENTAHO");
    assert.equal(employee.sourceUpdatedBy, "PENTAHO");
    assert.notEqual(employee.createdAt, sourceCreatedAt);
    assert.notEqual(employee.updatedAt, sourceUpdatedAt);
  });

  it("uses one mapping lookup and one serialized transaction", async () => {
    await syncEmployeeSnapshot(snapshot());

    assert.equal(state.mappingQueries, 1);
    assert.equal(transactionMock.mock.callCount(), 1);
    assert.equal(state.lockQueries, 1);
  });

  it("rejects default empty snapshots without presence or account mutation", async () => {
    state.employees = [employeeState()];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "SSO",
        isActive: true,
        unitId: "unit-1",
      },
    ];

    await assert.rejects(() =>
      syncEmployeeSnapshot({ sourceSystem: "PENTAHO", employees: [] }),
    );

    assert.equal(transactionMock.mock.callCount(), 0);
    assert.equal(state.employees[0].isPresentInSource, true);
    assert.equal(state.users[0].isActive, true);
    assert.equal(state.runs[0].status, "FAILED");
  });

  it("allows an explicitly trusted empty snapshot and records the override", async () => {
    state.employees = [employeeState()];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "SSO",
        isActive: true,
        unitId: "unit-1",
      },
    ];

    await syncEmployeeSnapshot(
      { sourceSystem: "PENTAHO", employees: [] },
      { allowEmptySnapshot: true },
    );

    assert.equal(state.employees[0].isPresentInSource, false);
    assert.equal(state.users[0].isActive, false);
    assert.equal(state.runs[0].status, "SUCCEEDED");
    assert.deepEqual(state.runs[0].sourceMetadata, {
      emptySnapshotOverride: true,
    });
  });

  it("fails before Employee mutation when mapping is missing", async () => {
    state.mappings = [];
    const before = structuredClone(state);

    await assert.rejects(() => syncEmployeeSnapshot(snapshot()));

    assert.deepEqual(state.employees, before.employees);
    assert.equal(state.users.length, 0);
    assert.equal(state.runs[0].status, "FAILED");
  });

  it("rolls back Employee and User changes when a later write fails", async () => {
    state.employees = [employeeState({ nip: "old" })];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "SSO",
        isActive: true,
        unitId: "unit-1",
      },
    ];
    state.failOnUpsertNumber = 1;
    const before = structuredClone(state);

    await assert.rejects(() => syncEmployeeSnapshot(snapshot()));

    assert.deepEqual(state.employees, before.employees);
    assert.deepEqual(state.users, before.users);
    assert.equal(state.runs[0].status, "FAILED");
  });

  it("deactivates an SSO PIC on unit mutation without changing role or User.unitId", async () => {
    state.employees = [employeeState()];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "SSO",
        isActive: true,
        unitId: "application-unit",
      },
    ];
    state.mappings = [mapping("UNIT-1", "unit-new")];

    await syncEmployeeSnapshot(snapshot());

    assert.equal(state.employees[0].unitId, "unit-new");
    assert.equal(state.users[0].isActive, false);
    assert.equal(state.users[0].role, "PIC");
    assert.equal(state.users[0].unitId, "application-unit");
  });

  it("fails closed when an active LOCAL PIC would require deactivation", async () => {
    state.employees = [employeeState()];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "LOCAL",
        isActive: true,
        unitId: "application-unit",
      },
    ];
    state.mappings = [mapping("UNIT-1", "unit-new")];
    const before = structuredClone(state);

    await assert.rejects(() => syncEmployeeSnapshot(snapshot()));

    assert.deepEqual(state.employees, before.employees);
    assert.deepEqual(state.users, before.users);
    assert.equal(state.runs[0].status, "FAILED");
  });

  it("does not mutate an inactive LOCAL account when Employee data changes", async () => {
    state.employees = [employeeState()];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "LOCAL",
        isActive: false,
        unitId: "application-unit",
      },
    ];
    state.mappings = [mapping("UNIT-1", "unit-new")];

    await syncEmployeeSnapshot(snapshot());

    assert.equal(state.employees[0].unitId, "unit-new");
    assert.equal(state.users[0].isActive, false);
    assert.equal(state.users[0].unitId, "application-unit");
  });

  it("marks missing Employees and deactivates only linked active SSO users", async () => {
    state.employees = [employeeState()];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "SSO",
        isActive: true,
        unitId: "unit-1",
      },
    ];

    await syncEmployeeSnapshot(snapshot(completeEmployee({ nip: "new" })));

    assert.equal(state.employees[0].isPresentInSource, false);
    assert.equal(state.users[0].isActive, false);
    assert.equal(state.users[0].role, "PIC");
    assert.equal(state.users[0].unitId, "unit-1");
    assert.equal(state.employees.length, 2);
  });

  it("fails closed when a missing Employee would deactivate an active LOCAL user", async () => {
    state.employees = [employeeState()];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "LOCAL",
        isActive: true,
        unitId: "unit-1",
      },
    ];
    const before = structuredClone(state);

    await assert.rejects(() =>
      syncEmployeeSnapshot(snapshot(completeEmployee({ nip: "new" }))),
    );

    assert.deepEqual(state.employees, before.employees);
    assert.deepEqual(state.users, before.users);
    assert.equal(state.runs[0].status, "FAILED");
  });

  it("does not automatically reactivate a reappearing Employee user", async () => {
    state.employees = [employeeState({ isPresentInSource: false })];
    state.users = [
      {
        id: "user-1",
        employeeId: "employee-existing",
        role: "PIC",
        authProvider: "SSO",
        isActive: false,
        unitId: "unit-1",
      },
    ];

    await syncEmployeeSnapshot(snapshot());

    assert.equal(state.employees[0].isPresentInSource, true);
    assert.equal(state.users[0].isActive, false);
  });

  it("rejects a stale concurrent snapshot before Employee mutation", async () => {
    state.newerSuccessfulRun = { id: "newer-run" };
    const before = structuredClone(state);

    await assert.rejects(() => syncEmployeeSnapshot(snapshot()));

    assert.equal(state.lockQueries, 1);
    assert.deepEqual(state.employees, before.employees);
    assert.equal(state.runs[0].status, "FAILED");
  });

  it("keeps the PIC lifecycle helper limited to domain mutations", () => {
    const existingPic: ExistingEmployeeForSync = {
      unitId: "unit-old",
      user: {
        id: "user-1",
        role: "PIC",
        isActive: true,
        authProvider: "SSO",
      },
    };

    assert.equal(
      shouldDeactivateLinkedPicUser(existingPic, {
        unitId: "unit-new",
        jenjang: "5",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: true,
      }),
      true,
    );

    assert.equal(
      shouldDeactivateLinkedPicUser(existingPic, {
        unitId: "unit-old",
        jenjang: "5",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: true,
      }),
      false,
    );

    assert.equal(
      shouldDeactivateLinkedPicUser(existingPic, {
        unitId: "unit-old",
        jenjang: "4",
        kodeStatpeg: "01",
        statKepeg: "02",
        isPresentInSource: true,
      }),
      true,
    );
  });
});
