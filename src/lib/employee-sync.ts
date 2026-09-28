import { createHash } from "node:crypto";
import { Prisma } from "@generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isPicEligible,
  type EmployeeEligibilityInput,
} from "@/lib/employee-eligibility";
import {
  parseEmployeeSnapshot,
  type NormalizedEmployee,
  type NormalizedEmployeeSnapshot,
} from "@/lib/employee-sync-contract";
import { PENTAHO_SOURCE_SYSTEM } from "@/lib/pentaho-unit-mapping";
import { ZodError } from "zod";

const EMPLOYEE_SYNC_TRANSACTION_TIMEOUT_MS = 300_000;

export type ExistingEmployeeForSync = {
  unitId: string | null;
  user: {
    id: string;
    role: "ADMIN" | "PIC" | "VIEWER";
    isActive: boolean;
    authProvider: string;
  } | null;
};

export type EmployeeSyncOptions = {
  /**
   * Internal trusted orchestration option.
   * Never expose this directly to an untrusted HTTP request.
   */
  allowEmptySnapshot?: boolean;
  /** Internal seam for an orchestrator that atomically claimed RECONCILING. */
  allowReconcilePhase?: boolean;
  /** Internal run-channel expectation; Pentaho remains the compatibility default. */
  expectedChannel?: "PENTAHO" | "EXCEL_IMPORT";
  /** Runs under the source lock before any Employee or User reads/writes. */
  transactionGuard?: (tx: Prisma.TransactionClient) => Promise<void>;
};

export type EmployeeSyncResult = {
  runId: string;
  sourceSystem: string;
  receivedCount: number;
  processedCount: number;
  missingCount: number;
  deactivatedCount: number;
};

/**
 * Releases crashed Excel imports once their bounded reconciliation window has
 * elapsed. The source advisory lock makes this mutually exclusive with both
 * Pentaho and Excel reconciliation transactions.
 */
export async function recoverExpiredEmployeeExcelRuns(now = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
      SELECT pg_try_advisory_xact_lock(hashtext(${`employee-sync:${PENTAHO_SOURCE_SYSTEM}`})::bigint) AS locked
    `);
    if (!lock[0]?.locked) return;

    await tx.employeeSyncRun.updateMany({
      where: {
        sourceSystem: PENTAHO_SOURCE_SYSTEM,
        channel: "EXCEL_IMPORT",
        status: "RUNNING",
        phase: { in: ["VALIDATING", "RECONCILING"] },
        deadlineAt: { lte: now },
      },
      data: {
        status: "FAILED",
        phase: "COMPLETED",
        completedAt: now,
        processedCount: 0,
        missingCount: 0,
        deactivatedCount: 0,
        errorMessage: "EMPLOYEE_IMPORT_DEADLINE_EXCEEDED",
      },
    });
  });
}

export function shouldDeactivateLinkedPicUser(
  existingEmployee: ExistingEmployeeForSync,
  nextEmployee: EmployeeEligibilityInput & { unitId: string },
): boolean {
  return (
    existingEmployee.user?.role === "PIC" &&
    (existingEmployee.unitId !== nextEmployee.unitId ||
      !isPicEligible(nextEmployee))
  );
}

export class EmployeeSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeeSnapshotValidationError";
  }
}

function toEligibilityInput(
  employee: NormalizedEmployee,
): EmployeeEligibilityInput {
  return {
    jenjang: employee.jenjang,
    kodeStatpeg: employee.kodeStatpeg,
    statKepeg: employee.statKepeg,
    isPresentInSource: true,
  };
}

function toSourceMetadata(
  snapshot: NormalizedEmployeeSnapshot,
  options: EmployeeSyncOptions,
): Prisma.InputJsonValue | undefined {
  if (options.allowEmptySnapshot !== true) {
    return snapshot.sourceMetadata as Prisma.InputJsonValue | undefined;
  }

  return {
    ...(snapshot.sourceMetadata ?? {}),
    emptySnapshotOverride: true,
  } as Prisma.InputJsonValue;
}

function failureSourceSystem(input: unknown): string {
  if (typeof input !== "object" || input === null) {
    return "UNKNOWN";
  }

  const candidate =
    "sourceSystem" in input && typeof input.sourceSystem === "string"
      ? input.sourceSystem.trim()
      : "";

  return /^[A-Za-z0-9._:-]{1,64}$/.test(candidate) ? candidate : "UNKNOWN";
}

function failureReceivedCount(input: unknown): number {
  if (typeof input !== "object" || input === null) {
    return 0;
  }

  return "employees" in input && Array.isArray(input.employees)
    ? input.employees.length
    : 0;
}

function sanitizedErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    const fields = error.issues
      .map((issue) => issue.path.join(".") || "snapshot")
      .filter((field, index, all) => all.indexOf(field) === index)
      .join(", ");

    return `SNAPSHOT_VALIDATION_FAILED${fields ? `:${fields}` : ""}`.slice(
      0,
      2_000,
    );
  }

  if (error instanceof EmployeeSnapshotValidationError) {
    return "SNAPSHOT_RECONCILIATION_VALIDATION_FAILED";
  }

  return "SNAPSHOT_RECONCILIATION_FAILED";
}

async function recordFailedSnapshotRun(input: unknown, error: unknown) {
  return prisma.employeeSyncRun.create({
    data: {
      sourceSystem: failureSourceSystem(input),
      status: "FAILED",
      receivedCount: failureReceivedCount(input),
      processedCount: 0,
      missingCount: 0,
      completedAt: new Date(),
      errorMessage: sanitizedErrorMessage(error),
    },
    select: {
      id: true,
    },
  });
}

async function markRunFailed(runId: string, error: unknown): Promise<void> {
  await prisma.employeeSyncRun.updateMany({
    where: {
      id: runId,
      status: "RUNNING",
    },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      processedCount: 0,
      missingCount: 0,
      deactivatedCount: 0,
      errorMessage: sanitizedErrorMessage(error),
    },
  });
}

async function resolveUnitMappings(
  tx: Prisma.TransactionClient,
  sourceSystem: string,
  externalUnitCodes: string[],
): Promise<Map<string, string>> {
  if (externalUnitCodes.length === 0) {
    return new Map();
  }

  const mappings = await tx.unitExternalMapping.findMany({
    where: {
      sourceSystem,
      externalUnitCode: {
        in: externalUnitCodes,
      },
    },
    select: {
      externalUnitCode: true,
      unitId: true,
      unit: {
        select: {
          id: true,
        },
      },
    },
  });

  const stateByCode = new Map<
    string,
    {
      unitIds: string[];
      invalid: boolean;
    }
  >();

  for (const mapping of mappings) {
    const state = stateByCode.get(mapping.externalUnitCode) ?? {
      unitIds: [],
      invalid: false,
    };

    if (!mapping.unit || mapping.unit.id !== mapping.unitId) {
      state.invalid = true;
    } else {
      state.unitIds.push(mapping.unitId);
    }

    stateByCode.set(mapping.externalUnitCode, state);
  }

  const missingCodes = externalUnitCodes.filter(
    (code) => !stateByCode.has(code),
  );

  const invalidCodes = externalUnitCodes.filter(
    (code) => stateByCode.get(code)?.invalid === true,
  );

  const ambiguousCodes = externalUnitCodes.filter((code) => {
    const state = stateByCode.get(code);
    return state !== undefined && !state.invalid && state.unitIds.length !== 1;
  });

  if (
    missingCodes.length > 0 ||
    invalidCodes.length > 0 ||
    ambiguousCodes.length > 0
  ) {
    throw new EmployeeSnapshotValidationError(
      [
        missingCodes.length > 0
          ? `mapping missing=${missingCodes.join(", ")}`
          : "",
        invalidCodes.length > 0
          ? `mapping invalid=${invalidCodes.join(", ")}`
          : "",
        ambiguousCodes.length > 0
          ? `mapping ambiguous=${ambiguousCodes.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }

  return new Map(
    externalUnitCodes.map((code) => [code, stateByCode.get(code)!.unitIds[0]]),
  );
}

function isActiveNonSsoUser(user: {
  isActive: boolean;
  authProvider: string;
}): boolean {
  return user.isActive && user.authProvider !== "SSO";
}

async function reconcileWithinTransaction(
  tx: Prisma.TransactionClient,
  snapshot: NormalizedEmployeeSnapshot,
  run: {
    id: string;
    startedAt: Date;
  },
  transactionGuard?: (tx: Prisma.TransactionClient) => Promise<void>,
  channel: "PENTAHO" | "EXCEL_IMPORT" = "PENTAHO",
): Promise<{
  processedCount: number;
  missingCount: number;
  deactivatedCount: number;
}> {
  const lockKey = `employee-sync:${snapshot.sourceSystem}`;

  await tx.$queryRaw<{ lockAcquired: number }[]>(
    Prisma.sql`
      SELECT 1::integer AS "lockAcquired"
      FROM pg_advisory_xact_lock(hashtext(${lockKey})::bigint)
    `,
  );

  await transactionGuard?.(tx);

  const reconciliationAt = new Date();

  const newerSuccessfulRun = await tx.employeeSyncRun.findFirst({
    where: {
      sourceSystem: snapshot.sourceSystem,
      status: "SUCCEEDED",
      completedAt: {
        gt: run.startedAt,
      },
    },
    select: {
      id: true,
    },
  });

  if (newerSuccessfulRun) {
    throw new EmployeeSnapshotValidationError(
      `Snapshot stale karena sudah ada EmployeeSyncRun SUCCEEDED yang lebih baru: ${newerSuccessfulRun.id}`,
    );
  }

  const excelImport = channel === "EXCEL_IMPORT";
  const inspection = await inspectEmployeeSnapshot(tx, snapshot, {
    ignoreSourceAuditMetadata: excelImport,
  });
  const { unitIdByExternalCode, missingIds: missingEmployeeIds } = inspection;
  const uniquePicUserIds = inspection.picUserIdsToDeactivate;
  const excelAuditByNip = new Map<string, {
    sourceCreatedAt: Date | null;
    sourceCreatedBy: string | null;
    sourceUpdatedAt: Date | null;
    sourceUpdatedBy: string | null;
  }>();

  if (excelImport) {
    for (const employee of snapshot.employees) {
      const existing = inspection.existingByNip.get(employee.nip);
      if (!existing) {
        excelAuditByNip.set(employee.nip, {
          sourceCreatedAt: reconciliationAt,
          sourceCreatedBy: "Excel Import",
          sourceUpdatedAt: reconciliationAt,
          sourceUpdatedBy: "Excel Import",
        });
      } else {
        const changed = inspection.changedNips.has(employee.nip);
        excelAuditByNip.set(employee.nip, {
          sourceCreatedAt: existing.sourceCreatedAt,
          sourceCreatedBy: existing.sourceCreatedBy,
          sourceUpdatedAt: changed ? reconciliationAt : existing.sourceUpdatedAt,
          sourceUpdatedBy: changed ? "Excel Import" : existing.sourceUpdatedBy,
        });
      }
    }
  }

  let deactivatedCount = 0;

  if (uniquePicUserIds.length > 0) {
    const deactivatedPics = await tx.user.updateMany({
      where: {
        id: {
          in: uniquePicUserIds,
        },
        authProvider: "SSO",
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    deactivatedCount += deactivatedPics.count;
  }

  for (const employee of snapshot.employees) {
    const unitId = unitIdByExternalCode.get(employee.externalUnitCode);
    const audit = excelAuditByNip.get(employee.nip) ?? employee;
    if (!unitId) {
      throw new EmployeeSnapshotValidationError(
        `UnitExternalMapping tidak ditemukan untuk kode ${employee.externalUnitCode}`,
      );
    }

    await tx.employee.upsert({
      where: {
        nip: employee.nip,
      },
      create: {
        nip: employee.nip,
        name: employee.name,
        jobTitle: employee.jobTitle,
        jenjang: employee.jenjang,
        jenjangLabel: employee.jenjangLabel,
        kodeStatpeg: employee.kodeStatpeg,
        statKepeg: employee.statKepeg,
        sourceKodeDolog: employee.sourceKodeDolog,
        sourceKodeSubdolog: employee.sourceKodeSubdolog,
        sourceKodeKansilog: employee.sourceKodeKansilog,
        sourceKodeGudang: employee.sourceKodeGudang,
        sourceKodeOrg: employee.sourceKodeOrg,
        sourceNamaOrg: employee.sourceNamaOrg,
        sourceNamaSatker: employee.sourceNamaSatker,
        sourceNamaInduk: employee.sourceNamaInduk,
        sourceCreatedAt: audit.sourceCreatedAt,
        sourceCreatedBy: audit.sourceCreatedBy,
        sourceUpdatedAt: audit.sourceUpdatedAt,
        sourceUpdatedBy: audit.sourceUpdatedBy,
        unitId,
        isPresentInSource: true,
        lastSeenAt: reconciliationAt,
        lastSeenSyncRunId: run.id,
      },
      update: {
        name: employee.name,
        jobTitle: employee.jobTitle,
        jenjang: employee.jenjang,
        jenjangLabel: employee.jenjangLabel,
        kodeStatpeg: employee.kodeStatpeg,
        statKepeg: employee.statKepeg,
        sourceKodeDolog: employee.sourceKodeDolog,
        sourceKodeSubdolog: employee.sourceKodeSubdolog,
        sourceKodeKansilog: employee.sourceKodeKansilog,
        sourceKodeGudang: employee.sourceKodeGudang,
        sourceKodeOrg: employee.sourceKodeOrg,
        sourceNamaOrg: employee.sourceNamaOrg,
        sourceNamaSatker: employee.sourceNamaSatker,
        sourceNamaInduk: employee.sourceNamaInduk,
        sourceCreatedAt: audit.sourceCreatedAt,
        sourceCreatedBy: audit.sourceCreatedBy,
        sourceUpdatedAt: audit.sourceUpdatedAt,
        sourceUpdatedBy: audit.sourceUpdatedBy,
        unitId,
        isPresentInSource: true,
        lastSeenAt: reconciliationAt,
        lastSeenSyncRunId: run.id,
      },
    });
  }

  if (missingEmployeeIds.length > 0) {
    await tx.employee.updateMany({
      where: {
        id: {
          in: missingEmployeeIds,
        },
      },
      data: {
        isPresentInSource: false,
      },
    });

    const missingUsers = await tx.user.updateMany({
      where: {
        employeeId: {
          in: missingEmployeeIds,
        },
        authProvider: "SSO",
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    deactivatedCount += missingUsers.count;
  }

  const finalizedRun = await tx.employeeSyncRun.updateMany({
    where: {
      id: run.id,
      status: "RUNNING",
      phase: "RECONCILING",
    },
    data: {
      status: "SUCCEEDED",
      completedAt: reconciliationAt,
      processedCount: snapshot.employees.length,
      missingCount: missingEmployeeIds.length,
      deactivatedCount,
      phase: "COMPLETED",
      errorMessage: null,
    },
  });

  if (finalizedRun.count !== 1) {
    throw new EmployeeSnapshotValidationError(
      "EmployeeSyncRun sudah berubah sebelum reconciliation selesai",
    );
  }

  return {
    processedCount: snapshot.employees.length,
    missingCount: missingEmployeeIds.length,
    deactivatedCount,
  };
}

async function reconcileSnapshotForRun(
  run: { id: string; startedAt: Date },
  snapshot: NormalizedEmployeeSnapshot,
  transactionGuard?: (tx: Prisma.TransactionClient) => Promise<void>,
  channel: "PENTAHO" | "EXCEL_IMPORT" = "PENTAHO",
): Promise<EmployeeSyncResult> {
  try {
    const result = await prisma.$transaction(
      async (tx) =>
        reconcileWithinTransaction(
          tx,
          snapshot,
          run,
          transactionGuard,
          channel,
        ),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: EMPLOYEE_SYNC_TRANSACTION_TIMEOUT_MS,
      },
    );

    return {
      runId: run.id,
      sourceSystem: snapshot.sourceSystem,
      receivedCount: snapshot.employees.length,
      ...result,
    };
  } catch (error) {
    await markRunFailed(run.id, error);

    throw error;
  }
}

type EmployeeSnapshotImpact = {
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  missingCount: number;
  deactivationCount: number;
  details: Array<{ nip: string; change: "NEW" | "CHANGED" | "UNCHANGED" | "MISSING" | "DEACTIVATION" }>;
};

function sameDate(left: Date | null, right: Date): boolean {
  return left !== null && left.getTime() === right.getTime();
}

async function inspectEmployeeSnapshot(
  tx: Prisma.TransactionClient,
  snapshot: NormalizedEmployeeSnapshot,
  options: { ignoreSourceAuditMetadata?: boolean } = {},
) {
  const nips = snapshot.employees.map((employee) => employee.nip);
  const externalUnitCodes = [...new Set(snapshot.employees.map((employee) => employee.externalUnitCode))];
  const unitIdByExternalCode = await resolveUnitMappings(tx, snapshot.sourceSystem, externalUnitCodes);
  const existingEmployees = await tx.employee.findMany({
    where: { nip: { in: nips } },
    select: {
      id: true, nip: true, name: true, jobTitle: true, jenjang: true, jenjangLabel: true,
      kodeStatpeg: true, statKepeg: true, sourceKodeDolog: true, sourceKodeSubdolog: true,
      sourceKodeKansilog: true, sourceKodeGudang: true, sourceKodeOrg: true,
      sourceNamaOrg: true, sourceNamaSatker: true, sourceNamaInduk: true,
      sourceCreatedAt: true, sourceCreatedBy: true, sourceUpdatedAt: true, sourceUpdatedBy: true,
      unitId: true, isPresentInSource: true,
      user: { select: { id: true, role: true, isActive: true, authProvider: true } },
    },
  });
  const existingByNip = new Map(existingEmployees.map((employee) => [employee.nip, employee]));
  const missingCandidates = await tx.employee.findMany({
    where: { isPresentInSource: true, nip: { notIn: nips } },
    select: {
      id: true, nip: true,
      user: { select: { id: true, isActive: true, authProvider: true } },
    },
  });

  const missingLocalMutationCandidates = missingCandidates.filter(
    (employee) => employee.user !== null && isActiveNonSsoUser(employee.user),
  );
  if (missingLocalMutationCandidates.length > 0) {
    throw new EmployeeSnapshotValidationError(
      `Snapshot akan menonaktifkan User non-SSO yang masih aktif untuk NIP: ${missingLocalMutationCandidates.map((employee) => employee.nip).join(", ")}`,
    );
  }

  const picUserIdsToDeactivate: string[] = [];
  const details: EmployeeSnapshotImpact["details"] = [];
  let newCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  const changedNips = new Set<string>();
  const fingerprintRows: unknown[] = [];

  for (const employee of snapshot.employees) {
    const unitId = unitIdByExternalCode.get(employee.externalUnitCode);
    if (!unitId) throw new EmployeeSnapshotValidationError("UnitExternalMapping tidak ditemukan");
    const existing = existingByNip.get(employee.nip);
    if (!existing) {
      newCount++;
      details.push({ nip: employee.nip, change: "NEW" });
    } else {
      const changed = !existing.isPresentInSource || existing.name !== employee.name ||
        existing.jobTitle !== employee.jobTitle || existing.jenjang !== employee.jenjang ||
        existing.jenjangLabel !== employee.jenjangLabel || existing.kodeStatpeg !== employee.kodeStatpeg ||
        existing.statKepeg !== employee.statKepeg || existing.sourceKodeDolog !== employee.sourceKodeDolog ||
        existing.sourceKodeSubdolog !== employee.sourceKodeSubdolog || existing.sourceKodeKansilog !== employee.sourceKodeKansilog ||
        existing.sourceKodeGudang !== employee.sourceKodeGudang || existing.sourceKodeOrg !== employee.sourceKodeOrg ||
        existing.sourceNamaOrg !== employee.sourceNamaOrg || existing.sourceNamaSatker !== employee.sourceNamaSatker ||
        existing.sourceNamaInduk !== employee.sourceNamaInduk ||
        (!options.ignoreSourceAuditMetadata && (
          !sameDate(existing.sourceCreatedAt, employee.sourceCreatedAt) ||
          existing.sourceCreatedBy !== employee.sourceCreatedBy ||
          !sameDate(existing.sourceUpdatedAt, employee.sourceUpdatedAt) ||
          existing.sourceUpdatedBy !== employee.sourceUpdatedBy
        )) || existing.unitId !== unitId;
      if (changed) {
        changedCount++;
        changedNips.add(employee.nip);
        details.push({ nip: employee.nip, change: "CHANGED" });
      } else {
        unchangedCount++;
        details.push({ nip: employee.nip, change: "UNCHANGED" });
      }

      const nextEmployee = { ...toEligibilityInput(employee), unitId };
      if (existing.user && shouldDeactivateLinkedPicUser(existing, nextEmployee)) {
        if (existing.user.authProvider === "SSO") {
          if (existing.user.isActive) {
            picUserIdsToDeactivate.push(existing.user.id);
            details.push({ nip: employee.nip, change: "DEACTIVATION" });
          }
        } else if (existing.user.isActive) {
          throw new EmployeeSnapshotValidationError(
            `Snapshot akan menonaktifkan User non-SSO yang masih aktif untuk NIP ${employee.nip}`,
          );
        }
      }
    }
    if (existing && options.ignoreSourceAuditMetadata) {
      const existingWithoutSourceAuditMetadata = {
        id: existing.id,
        nip: existing.nip,
        name: existing.name,
        jobTitle: existing.jobTitle,
        jenjang: existing.jenjang,
        jenjangLabel: existing.jenjangLabel,
        kodeStatpeg: existing.kodeStatpeg,
        statKepeg: existing.statKepeg,
        sourceKodeDolog: existing.sourceKodeDolog,
        sourceKodeSubdolog: existing.sourceKodeSubdolog,
        sourceKodeKansilog: existing.sourceKodeKansilog,
        sourceKodeGudang: existing.sourceKodeGudang,
        sourceKodeOrg: existing.sourceKodeOrg,
        sourceNamaOrg: existing.sourceNamaOrg,
        sourceNamaSatker: existing.sourceNamaSatker,
        sourceNamaInduk: existing.sourceNamaInduk,
        unitId: existing.unitId,
        isPresentInSource: existing.isPresentInSource,
        user: existing.user,
      };
      fingerprintRows.push({ nip: employee.nip, unitId, existing: existingWithoutSourceAuditMetadata });
    } else {
      fingerprintRows.push({ nip: employee.nip, unitId, existing: existing ?? null });
    }
  }

  const missingIds = missingCandidates.map((employee) => employee.id);
  const missingSsoUsers = missingCandidates.filter(
    (employee) => employee.user?.authProvider === "SSO" && employee.user.isActive,
  );
  for (const employee of missingCandidates) {
    details.push({ nip: employee.nip, change: "MISSING" });
    fingerprintRows.push({ nip: employee.nip, missing: true, user: employee.user });
  }
  for (const employee of missingSsoUsers) {
    details.push({ nip: employee.nip, change: "DEACTIVATION" });
  }
  const deactivationCount = new Set([
    ...picUserIdsToDeactivate,
    ...missingSsoUsers.flatMap((employee) => employee.user ? [employee.user.id] : []),
  ]).size;

  const impact: EmployeeSnapshotImpact = {
    newCount, changedCount, unchangedCount, missingCount: missingCandidates.length,
    deactivationCount, details: details.slice(0, 100),
  };
  const impactHash = createHash("sha256")
    .update(JSON.stringify({ rows: fingerprintRows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), impact: { newCount, changedCount, unchangedCount, missingCount: missingCandidates.length, deactivationCount } }))
    .digest("hex");
  return { unitIdByExternalCode, existingByNip, changedNips, missingCandidates, missingIds, picUserIdsToDeactivate: [...new Set(picUserIdsToDeactivate)], impact, impactHash };
}

export async function inspectEmployeeSnapshotForPreview(
  tx: Prisma.TransactionClient,
  snapshot: NormalizedEmployeeSnapshot,
  options: { ignoreSourceAuditMetadata?: boolean } = {},
) {
  const inspected = await inspectEmployeeSnapshot(tx, snapshot, options);
  return { ...inspected.impact, impactHash: inspected.impactHash };
}

class EmployeeSnapshotClaimLostError extends Error {
  constructor() {
    super("EmployeeSyncRun sudah diambil oleh reconciliation lain");
    this.name = "EmployeeSnapshotClaimLostError";
  }
}

export async function syncEmployeeSnapshotForRun(
  runId: string,
  input: unknown,
  options: EmployeeSyncOptions = {},
): Promise<EmployeeSyncResult> {
  const run = await prisma.employeeSyncRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      sourceSystem: true,
      status: true,
      phase: true,
      channel: true,
      startedAt: true,
    },
  });

  if (!run) {
    throw new EmployeeSnapshotValidationError("EmployeeSyncRun tidak ditemukan");
  }

  if (run.status !== "RUNNING" || run.phase === "COMPLETED") {
    throw new EmployeeSnapshotValidationError(
      "EmployeeSyncRun bukan run RUNNING yang dapat direkonsiliasi",
    );
  }

  try {
    if (run.channel !== (options.expectedChannel ?? "PENTAHO")) {
      throw new EmployeeSnapshotValidationError(
        "EmployeeSyncRun channel tidak sesuai dengan caller reconciliation",
      );
    }

    const snapshot = parseEmployeeSnapshot(input);

    if (
      snapshot.sourceSystem !== run.sourceSystem ||
      snapshot.sourceSystem !== PENTAHO_SOURCE_SYSTEM
    ) {
      throw new EmployeeSnapshotValidationError(
        "sourceSystem snapshot tidak sesuai dengan EmployeeSyncRun",
      );
    }

    if (snapshot.employees.length === 0 && options.allowEmptySnapshot !== true) {
      throw new EmployeeSnapshotValidationError(
        "Employee snapshot kosong ditolak. Gunakan allowEmptySnapshot hanya dari orchestration tepercaya.",
      );
    }

    const claimedRun = await prisma.employeeSyncRun.updateMany({
      where: {
        id: run.id,
        status: "RUNNING",
        OR: [
          { phase: null },
          { phase: "TRIGGERING" },
          { phase: "PENTAHO_RUNNING" },
          { phase: "VALIDATING" },
          ...(options.allowReconcilePhase === true ? [{ phase: "RECONCILING" as const }] : []),
        ],
      },
      data: {
        phase: "RECONCILING",
        receivedCount: snapshot.employees.length,
        sourceMetadata: toSourceMetadata(snapshot, options),
      },
    });

    if (claimedRun.count !== 1) {
      throw new EmployeeSnapshotClaimLostError();
    }

    return reconcileSnapshotForRun(run, snapshot, options.transactionGuard, run.channel);
  } catch (error) {
    if (!(error instanceof EmployeeSnapshotClaimLostError)) {
      await markRunFailed(run.id, error);
    }

    throw error;
  }
}

export async function syncEmployeeSnapshot(
  input: unknown,
  options: EmployeeSyncOptions = {},
): Promise<EmployeeSyncResult> {
  let snapshot: NormalizedEmployeeSnapshot;

  try {
    snapshot = parseEmployeeSnapshot(input);
  } catch (error) {
    await recordFailedSnapshotRun(input, error);
    throw error;
  }

  if (snapshot.employees.length === 0 && options.allowEmptySnapshot !== true) {
    const error = new EmployeeSnapshotValidationError(
      "Employee snapshot kosong ditolak. Gunakan allowEmptySnapshot hanya dari orchestration tepercaya.",
    );

    await recordFailedSnapshotRun(input, error);
    throw error;
  }

  const sourceMetadata = toSourceMetadata(snapshot, options);

  const run = await prisma.employeeSyncRun.create({
    data: {
      sourceSystem: snapshot.sourceSystem,
      sourceMetadata,
      status: "RUNNING",
      receivedCount: snapshot.employees.length,
    },
    select: {
      id: true,
      startedAt: true,
    },
  });

  await prisma.employeeSyncRun.update({
    where: { id: run.id },
    data: { phase: "RECONCILING" },
  });

  return reconcileSnapshotForRun(run, snapshot);
}
