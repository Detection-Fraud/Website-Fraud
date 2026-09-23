import assert from "node:assert/strict";
import test from "node:test";
import { createEmployeePentahoOrchestrator } from "@/lib/employee-sync-orchestrator";
import {
  getPentahoEmployeeJobStatus,
  PentahoServiceError,
} from "@/lib/pentaho-service";
import type { EmployeeSyncStatus } from "@/types/employee-sync.types";

function run(overrides: Partial<any> = {}): any {
  return {
    id: "run-1",
    sourceSystem: "PENTAHO",
    status: "RUNNING",
    phase: "PENTAHO_RUNNING",
    externalJobName: "employee-sync-run-1",
    triggeredById: "admin-1",
    triggeredByName: "Admin",
    deadlineAt: new Date("2026-09-22T01:00:00.000Z"),
    startedAt: new Date("2026-09-22T00:00:00.000Z"),
    completedAt: null,
    receivedCount: 0,
    processedCount: 0,
    missingCount: 0,
    deactivatedCount: 0,
    errorMessage: null,
    ...overrides,
  };
}

function deps(initial = run()) {
  let current: any = initial;
  let executeCalls = 0;
  let reconcileCalls = 0;
  const runs = {
    findFirst: async (args: any) => args.where?.status === "RUNNING"
      ? (current?.status === "RUNNING" ? current : null)
      : current,
    findUnique: async () => current,
    create: async (args: any) => {
      current = run({ ...args.data, id: "run-created", externalJobName: null });
      return current;
    },
    update: async (args: any) => { current = { ...current, ...args.data }; return current; },
    updateMany: async (args: any) => {
      if (args.where.status && current.status !== args.where.status) return { count: 0 };
      if (args.where.phase?.in && !args.where.phase.in.includes(current.phase)) return { count: 0 };
      if (args.where.phase && !args.where.phase.in && current.phase !== args.where.phase) return { count: 0 };
      current = { ...current, ...args.data };
      return { count: 1 };
    },
  };
  return {
    runs,
    execute: async () => { executeCalls += 1; return { accepted: true as const, responseMetadata: {} }; },
    status: async (): ReturnType<typeof getPentahoEmployeeJobStatus> => ({
      state: "RUNNING",
      responseMetadata: {},
    }),
    mirror: async () => ({ sourceSystem: "PENTAHO" as const, employees: [] }),
    reconcile: async () => { reconcileCalls += 1; return { runId: "run-1", sourceSystem: "PENTAHO", receivedCount: 0, processedCount: 0, missingCount: 0, deactivatedCount: 0 }; },
    getConfig: () => ({ baseUrl: "http://pentaho.test", jobLocation: "sync_budaya.kjb", requestTimeoutMs: 1000, syncDeadlineMinutes: 30 }),
    now: () => new Date("2026-09-22T00:30:00.000Z"),
    recoverExpiredReconciliation: async () => null,
    get executeCalls() { return executeCalls; },
    get reconcileCalls() { return reconcileCalls; },
  };
}

test("projects only safe run fields", async () => {
  const d = deps(run({ sourceMetadata: { secret: "no" } }));
  const result = await createEmployeePentahoOrchestrator(d).getLatestEmployeePentahoSync();
  assert.equal((result as EmployeeSyncStatus).runId, "run-1");
  assert.equal(Object.hasOwn(result ?? {}, "sourceMetadata"), false);
});

test("start executes exactly once and does not send response metadata to the run", async () => {
  const d = deps(run({ status: "SUCCEEDED", phase: "COMPLETED", externalJobName: null }));
  const result = await createEmployeePentahoOrchestrator(d).startEmployeePentahoSync({ id: "admin-1", name: "Admin" });
  assert.equal(d.executeCalls, 1);
  assert.equal(result.phase, "PENTAHO_RUNNING");
  assert.equal(result.disposition, "STARTED");
  assert.equal(Object.hasOwn(result, "responseMetadata"), false);
});

test("running Pentaho status remains pending and never reconciles", async () => {
  const d = deps();
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "RUNNING");
  assert.equal(d.reconcileCalls, 0);
});

test("an existing active run is reused without executing another Pentaho job", async () => {
  const d = deps(run());
  const result = await createEmployeePentahoOrchestrator(d).startEmployeePentahoSync({ id: "admin-2", name: "Other Admin" });
  assert.equal(result.disposition, "REUSED");
  assert.equal(d.executeCalls, 0);
});

test("partial unique start race reuses the winning run", async () => {
  const d = deps(run({ status: "SUCCEEDED", phase: "COMPLETED" }));
  const winner = run({ id: "winner", phase: "PENTAHO_RUNNING" });
  d.runs.findFirst = async (args: any) => args.where?.status === "RUNNING" ? winner : null;
  d.runs.create = async () => { throw { code: "P2002" }; };
  const result = await createEmployeePentahoOrchestrator(d).startEmployeePentahoSync({ id: "admin-1", name: "Admin" });
  assert.equal(result.runId, "winner");
  assert.equal(result.disposition, "REUSED");
  assert.equal(d.executeCalls, 0);
});

test("terminal status is idempotent", async () => {
  const d = deps(run({ status: "SUCCEEDED", phase: "COMPLETED", completedAt: new Date() }));
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "SUCCEEDED");
  assert.equal(d.reconcileCalls, 0);
});

test("deadline fails an external run without reading the mirror", async () => {
  const d = deps(run({ deadlineAt: new Date("2026-09-22T00:01:00.000Z") }));
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorMessage, "PENTAHO_SYNC_DEADLINE_EXCEEDED");
  assert.equal(d.reconcileCalls, 0);
});

test("expired reconciliation is recovered only through its guarded recovery seam", async () => {
  const d = deps(run({ phase: "RECONCILING", deadlineAt: new Date("2026-09-22T00:01:00.000Z") }));
  let recoveryCalls = 0;
  d.recoverExpiredReconciliation = async () => {
    recoveryCalls += 1;
    return run({ status: "FAILED", errorMessage: "PENTAHO_SYNC_DEADLINE_EXCEEDED", completedAt: new Date() });
  };
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(recoveryCalls, 1);
  assert.equal(result.status, "FAILED");
  assert.equal(d.reconcileCalls, 0);
});

test("mirror validation failure marks the same run failed", async () => {
  const d = deps(run({ phase: "VALIDATING" }));
  d.mirror = async () => { throw new Error("adapter rejected"); };
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorMessage, "PENTAHO_MIRROR_VALIDATION_FAILED");
});

test("reconciliation or Unit mapping failure is sanitized on the same run", async () => {
  const d = deps(run({ phase: "VALIDATING" }));
  d.reconcile = async () => { throw new Error("UnitExternalMapping secret=NIP"); };
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorMessage, "PENTAHO_RECONCILIATION_FAILED");
});

test("malformed status fails the run instead of remaining pending", async () => {
  const d = deps();
  d.status = async () => { throw new PentahoServiceError("CONTRACT", "invalid response"); };
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorMessage, "PENTAHO_JOB_FAILED");
  assert.equal(d.reconcileCalls, 0);
});

test("ambiguous status transport failure remains pending until the deadline", async () => {
  const d = deps();
  d.status = async () => {
    throw new PentahoServiceError("TRANSPORT", "ambiguous transport", { ambiguous: true });
  };
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "RUNNING");
  assert.equal(d.reconcileCalls, 0);
});

test("recognized Pentaho failure marks the same run failed", async () => {
  const d = deps();
  d.status = async () => ({ state: "FAILED" as const, responseMetadata: {} });
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorMessage, "PENTAHO_JOB_FAILED");
});

test("recognized Pentaho success validates the mirror and reconciles the same run", async () => {
  const d = deps();
  d.status = async () => ({ state: "SUCCEEDED" as const, responseMetadata: {} });
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "RUNNING");
  assert.equal(d.reconcileCalls, 1);
});

test("concurrent advance calls allow only one validation owner", async () => {
  const d = deps();
  d.status = async () => ({ state: "SUCCEEDED" as const, responseMetadata: {} });
  const [first, second] = await Promise.all([
    createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1"),
    createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1"),
  ]);
  assert.equal(d.reconcileCalls, 1);
  assert.equal(first.status, "RUNNING");
  assert.equal(second.status, "RUNNING");
});

test("a VALIDATING run resumes from the mirror without querying Pentaho again", async () => {
  const d = deps(run({ phase: "VALIDATING" }));
  let statusCalls = 0;
  d.status = async () => { statusCalls += 1; return { state: "SUCCEEDED" as const, responseMetadata: {} }; };
  const result = await createEmployeePentahoOrchestrator(d).advanceEmployeePentahoSync("run-1");
  assert.equal(result.status, "RUNNING");
  assert.equal(statusCalls, 0);
  assert.equal(d.reconcileCalls, 1);
});

test("invalid execute contract fails the run without retry", async () => {
  const d = deps(run({ status: "SUCCEEDED", phase: "COMPLETED", externalJobName: null }));
  let executeCalls = 0;
  d.execute = async () => { executeCalls += 1; throw new PentahoServiceError("CONTRACT", "ambiguous response"); };
  const result = await createEmployeePentahoOrchestrator(d).startEmployeePentahoSync({ id: "admin-1", name: "Admin" });
  assert.equal(result.disposition, "STARTED");
  assert.equal(result.status, "FAILED");
  assert.equal(result.errorMessage, "PENTAHO_EXECUTE_REJECTED");
  assert.equal(executeCalls, 1);
});

test("ambiguous execute transport moves the run to polling without retry", async () => {
  const d = deps(run({ status: "SUCCEEDED", phase: "COMPLETED", externalJobName: null }));
  let executeCalls = 0;
  d.execute = async () => {
    executeCalls += 1;
    throw new PentahoServiceError("TRANSPORT", "ambiguous transport", { ambiguous: true });
  };
  const result = await createEmployeePentahoOrchestrator(d).startEmployeePentahoSync({ id: "admin-1", name: "Admin" });
  assert.equal(result.disposition, "STARTED");
  assert.equal(result.phase, "PENTAHO_RUNNING");
  assert.equal(executeCalls, 1);
});
