import { Prisma } from "@generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  executePentahoEmployeeJob,
  getPentahoEmployeeJobStatus,
  getPentahoServiceConfig,
  PentahoServiceError,
  type PentahoJobState,
} from "@/lib/pentaho-service";
import { readPentahoEmployeeMirror } from "@/lib/pentaho-stage-mirror";
import { recoverExpiredEmployeeExcelRuns, syncEmployeeSnapshotForRun } from "@/lib/employee-sync";
import { PENTAHO_SOURCE_SYSTEM } from "@/lib/pentaho-unit-mapping";
import type { NormalizedEmployeeSnapshot } from "@/lib/employee-sync-contract";
import type {
  EmployeeSyncStartResult,
  EmployeeSyncStatus,
} from "@/types/employee-sync.types";

const SOURCE_SYSTEM = PENTAHO_SOURCE_SYSTEM;
const FAILED_EXECUTE = "PENTAHO_EXECUTE_REJECTED";
const FAILED_STATUS = "PENTAHO_JOB_FAILED";
const FAILED_DEADLINE = "PENTAHO_SYNC_DEADLINE_EXCEEDED";
const FAILED_MIRROR = "PENTAHO_MIRROR_VALIDATION_FAILED";
const FAILED_RECONCILIATION = "PENTAHO_RECONCILIATION_FAILED";

type RunRecord = {
  id: string;
  sourceSystem: string;
  channel: "PENTAHO" | "EXCEL_IMPORT";
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  phase: "TRIGGERING" | "PENTAHO_RUNNING" | "VALIDATING" | "RECONCILING" | "COMPLETED" | null;
  externalJobName: string | null;
  triggeredById: string | null;
  triggeredByName: string | null;
  deadlineAt: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  receivedCount: number;
  processedCount: number;
  missingCount: number;
  deactivatedCount: number;
  errorMessage: string | null;
};

type RunDelegate = {
  findFirst: (args: unknown) => Promise<RunRecord | null>;
  findUnique: (args: unknown) => Promise<RunRecord | null>;
  create: (args: unknown) => Promise<RunRecord>;
  update: (args: unknown) => Promise<RunRecord>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
};

type OrchestratorDependencies = {
  runs: RunDelegate;
  execute: typeof executePentahoEmployeeJob;
  status: typeof getPentahoEmployeeJobStatus;
  mirror: typeof readPentahoEmployeeMirror;
  reconcile: typeof syncEmployeeSnapshotForRun;
  getConfig: typeof getPentahoServiceConfig;
  now: () => Date;
  recoverExpiredReconciliation: (runId: string, now: Date) => Promise<RunRecord | null>;
  recoverExpiredExcelRuns: (now: Date) => Promise<void>;
};

const selectRun = {
  id: true,
  sourceSystem: true,
  channel: true,
  status: true,
  phase: true,
  externalJobName: true,
  triggeredById: true,
  triggeredByName: true,
  deadlineAt: true,
  startedAt: true,
  completedAt: true,
  receivedCount: true,
  processedCount: true,
  missingCount: true,
  deactivatedCount: true,
  errorMessage: true,
} as const;

const defaultDependencies: OrchestratorDependencies = {
  runs: prisma.employeeSyncRun as unknown as RunDelegate,
  execute: executePentahoEmployeeJob,
  status: getPentahoEmployeeJobStatus,
  mirror: readPentahoEmployeeMirror,
  reconcile: syncEmployeeSnapshotForRun,
  getConfig: getPentahoServiceConfig,
  now: () => new Date(),
  recoverExpiredReconciliation: async (runId, now) => prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
      SELECT pg_try_advisory_xact_lock(hashtext(${`employee-sync:${SOURCE_SYSTEM}`})) AS locked
    `);
    if (!lock[0]?.locked) return null;

    const recovered = await tx.employeeSyncRun.updateMany({
      where: {
        id: runId,
        status: "RUNNING",
        phase: "RECONCILING",
        deadlineAt: { lte: now },
      },
      data: {
        status: "FAILED",
        completedAt: now,
        errorMessage: FAILED_DEADLINE,
      },
    });
    if (recovered.count !== 1) return null;

    return tx.employeeSyncRun.findUnique({ where: { id: runId }, select: selectRun });
  }),
  recoverExpiredExcelRuns: recoverExpiredEmployeeExcelRuns,
};

function isUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function safeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === "EmployeeSnapshotValidationError") {
    return FAILED_RECONCILIATION;
  }
  return fallback;
}

function project(run: RunRecord): EmployeeSyncStatus {
  return {
    runId: run.id,
    sourceSystem: run.sourceSystem,
    channel: run.channel,
    status: run.status,
    phase: run.phase,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    deadlineAt: run.deadlineAt?.toISOString() ?? null,
    receivedCount: run.receivedCount,
    processedCount: run.processedCount,
    missingCount: run.missingCount,
    deactivatedCount: run.deactivatedCount,
    errorMessage: run.errorMessage,
    canStart: run.status !== "RUNNING",
  };
}

function activeRunWhere() {
  return { where: { sourceSystem: SOURCE_SYSTEM, status: "RUNNING" }, select: selectRun };
}

function expired(run: RunRecord, now: Date): boolean {
  return run.status === "RUNNING" && run.deadlineAt !== null && run.deadlineAt.getTime() <= now.getTime();
}

async function failRun(
  deps: OrchestratorDependencies,
  runId: string,
  message: string,
  phases?: RunRecord["phase"][],
) {
  const nonNullPhases =
    phases?.filter(
      (phase): phase is Exclude<RunRecord["phase"], null> => phase !== null,
    ) ?? [];
  const phaseFilter = phases
    ? {
        OR: [
          ...(nonNullPhases.length > 0
            ? [{ phase: { in: nonNullPhases } }]
            : []),
          ...(phases.includes(null) ? [{ phase: null }] : []),
        ],
      }
    : {};

  await deps.runs.updateMany({
    where: {
      id: runId,
      status: "RUNNING",
      ...phaseFilter,
    },
    data: { status: "FAILED", completedAt: deps.now(), errorMessage: message },
  });
  return deps.runs.findUnique({ where: { id: runId }, select: selectRun });
}

async function transitionPhase(
  deps: OrchestratorDependencies,
  run: RunRecord,
  expectedPhase: RunRecord["phase"] | RunRecord["phase"][],
  nextPhase: NonNullable<RunRecord["phase"]>,
) {
  const phases = Array.isArray(expectedPhase) ? expectedPhase : [expectedPhase];
  const changed = await deps.runs.updateMany({
    where: {
      id: run.id,
      status: "RUNNING",
      phase: { in: phases },
    },
    data: { phase: nextPhase },
  });
  if (changed.count !== 1) {
    const current = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
    if (!current) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
    return current;
  }
  const current = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
  if (!current) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
  return current;
}

function executeIsAmbiguous(error: unknown): boolean {
  return error instanceof PentahoServiceError
    ? error.ambiguous || error.code === "CONTRACT"
    : true;
}

async function start(deps: OrchestratorDependencies, actor: { id: string; name: string }) {
  await deps.recoverExpiredExcelRuns(deps.now());
  const existing = await deps.runs.findFirst(activeRunWhere());
  if (existing) {
    return {
      ...project(existing),
      disposition: existing.channel === "PENTAHO" ? "REUSED" : "OTHER_CHANNEL_ACTIVE",
    } satisfies EmployeeSyncStartResult;
  }

  const config = deps.getConfig();
  const deadlineAt = new Date(deps.now().getTime() + config.syncDeadlineMinutes * 60_000);
  let run: RunRecord;
  try {
    run = await deps.runs.create({
      data: {
        sourceSystem: SOURCE_SYSTEM,
        channel: "PENTAHO",
        status: "RUNNING",
        phase: "TRIGGERING",
        triggeredById: actor.id,
        triggeredByName: actor.name,
        deadlineAt,
        receivedCount: 0,
        processedCount: 0,
        missingCount: 0,
        deactivatedCount: 0,
      },
      select: selectRun,
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const winner = await deps.runs.findFirst(activeRunWhere());
    if (!winner) throw error;
    return {
      ...project(winner),
      disposition: winner.channel === "PENTAHO" ? "REUSED" : "OTHER_CHANNEL_ACTIVE",
    } satisfies EmployeeSyncStartResult;
  }

  const externalJobName = `employee-sync-${run.id}`;
  const assignedJob = await deps.runs.updateMany({
    where: { id: run.id, status: "RUNNING", phase: "TRIGGERING" },
    data: { externalJobName },
  });
  if (assignedJob.count !== 1) {
    const current = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
    if (!current) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
    return { ...project(current), disposition: "STARTED" } satisfies EmployeeSyncStartResult;
  }
  const refreshedRun = await deps.runs.findUnique({
    where: { id: run.id },
    select: selectRun,
  });
  if (!refreshedRun) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
  run = refreshedRun;

  try {
    await deps.execute({ jobName: externalJobName });
    run = await transitionPhase(deps, run, "TRIGGERING", "PENTAHO_RUNNING");
  } catch (error) {
    if (executeIsAmbiguous(error)) {
      run = await transitionPhase(deps, run, "TRIGGERING", "PENTAHO_RUNNING");
    } else {
      const failed = await failRun(deps, run.id, FAILED_EXECUTE);
      if (!failed) throw error;
      run = failed;
    }
  }

  return { ...project(run), disposition: "STARTED" } satisfies EmployeeSyncStartResult;
}

async function advance(deps: OrchestratorDependencies, runId: string) {
  let run = await deps.runs.findUnique({ where: { id: runId }, select: selectRun });
  if (!run) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
  if (run.sourceSystem !== SOURCE_SYSTEM) throw new Error("EMPLOYEE_SYNC_RUN_SOURCE_MISMATCH");
  if (run.channel !== "PENTAHO") throw new Error("EMPLOYEE_SYNC_RUN_CHANNEL_MISMATCH");
  if (run.status !== "RUNNING") return project(run);

  const now = deps.now();
  if (
    expired(run, now) &&
    (run.phase === "TRIGGERING" || run.phase === "PENTAHO_RUNNING" || run.phase === null)
  ) {
    const failed = await failRun(
      deps,
      run.id,
      FAILED_DEADLINE,
      ["TRIGGERING", "PENTAHO_RUNNING", "VALIDATING", null],
    );
    if (!failed) throw new Error("EMPLOYEE_SYNC_RUN_UPDATE_FAILED");
    return project(failed);
  }

  if (expired(run, now) && run.phase === "RECONCILING") {
    const recovered = await deps.recoverExpiredReconciliation(run.id, now);
    return project(recovered ?? run);
  }

  if (run.phase === "RECONCILING") return project(run);

  if (run.phase === "TRIGGERING" || run.phase === "PENTAHO_RUNNING") {
    if (!run.externalJobName) {
      const failed = await failRun(deps, run.id, FAILED_EXECUTE);
      if (!failed) throw new Error("EMPLOYEE_SYNC_RUN_UPDATE_FAILED");
      return project(failed);
    }

    let state: PentahoJobState;
    try {
      ({ state } = await deps.status({ jobName: run.externalJobName }));
    } catch {
      return project(run);
    }

    if (state !== "RUNNING" && state !== "SUCCEEDED" && state !== "FAILED") {
      return project(run);
    }

    if (state === "RUNNING") {
      if (run.phase !== "PENTAHO_RUNNING") {
        run = await transitionPhase(deps, run, run.phase, "PENTAHO_RUNNING");
      }
      return project(run);
    }

    if (state === "FAILED") {
      const failed = await failRun(deps, run.id, FAILED_STATUS);
      if (!failed) throw new Error("EMPLOYEE_SYNC_RUN_UPDATE_FAILED");
      return project(failed);
    }

    const claimed = await deps.runs.updateMany({
      where: { id: run.id, status: "RUNNING", phase: { in: ["TRIGGERING", "PENTAHO_RUNNING"] } },
      data: { phase: "VALIDATING" },
    });
    if (claimed.count !== 1) {
      const current = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
      if (!current) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
      return project(current);
    }
    run = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
    if (!run) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
  }

  if (run.phase === "VALIDATING") {
    const validationClaim = await deps.runs.updateMany({
      where: { id: run.id, status: "RUNNING", phase: "VALIDATING" },
      data: { phase: "RECONCILING" },
    });
    if (validationClaim.count !== 1) {
      const current = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
      if (!current) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
      return project(current);
    }
    run = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
    if (!run) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
  }

  if (run.phase !== "RECONCILING") return project(run);

  let snapshot: NormalizedEmployeeSnapshot;
  try {
    snapshot = await deps.mirror();
  } catch {
    const failed = await failRun(deps, run.id, FAILED_MIRROR, ["RECONCILING"]);
    if (!failed) throw new Error("EMPLOYEE_SYNC_RUN_UPDATE_FAILED");
    return project(failed);
  }

  try {
    await deps.reconcile(run.id, snapshot, {
      allowReconcilePhase: true,
      expectedChannel: "PENTAHO",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "EmployeeSnapshotClaimLostError") {
      const current = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
      if (!current) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
      return project(current);
    }
    const failed = await failRun(
      deps,
      run.id,
      safeError(error, FAILED_RECONCILIATION),
      ["RECONCILING"],
    );
    if (!failed) throw error;
    return project(failed);
  }

  const succeeded = await deps.runs.findUnique({ where: { id: run.id }, select: selectRun });
  if (!succeeded) throw new Error("EMPLOYEE_SYNC_RUN_NOT_FOUND");
  return project(succeeded);
}

export function createEmployeePentahoOrchestrator(overrides: Partial<OrchestratorDependencies> = {}) {
  const deps = { ...defaultDependencies, ...overrides };
  return {
    startEmployeePentahoSync: (actor: { id: string; name: string }) => start(deps, actor),
    getLatestEmployeePentahoSync: async () => {
      await deps.recoverExpiredExcelRuns(deps.now());
      const active = await deps.runs.findFirst({
        where: { sourceSystem: SOURCE_SYSTEM, status: "RUNNING" },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        select: selectRun,
      });
      if (active) return project(active);
      const run = await deps.runs.findFirst({
        where: { sourceSystem: SOURCE_SYSTEM },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        select: selectRun,
      });
      return run ? project(run) : null;
    },
    advanceEmployeePentahoSync: (runId: string) => advance(deps, runId),
  };
}

const orchestrator = createEmployeePentahoOrchestrator();
export const startEmployeePentahoSync = orchestrator.startEmployeePentahoSync;
export const getLatestEmployeePentahoSync = orchestrator.getLatestEmployeePentahoSync;
export const advanceEmployeePentahoSync = orchestrator.advanceEmployeePentahoSync;
