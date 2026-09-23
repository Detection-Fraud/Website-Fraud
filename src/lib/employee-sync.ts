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
};

export type EmployeeSyncResult = {
  runId: string;
  sourceSystem: string;
  receivedCount: number;
  processedCount: number;
  missingCount: number;
  deactivatedCount: number;
};

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
  reconciliationAt: Date,
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

  const nips = snapshot.employees.map((employee) => employee.nip);

  const externalUnitCodes = [
    ...new Set(snapshot.employees.map((employee) => employee.externalUnitCode)),
  ];

  const unitIdByExternalCode = await resolveUnitMappings(
    tx,
    snapshot.sourceSystem,
    externalUnitCodes,
  );

  const existingEmployees = await tx.employee.findMany({
    where: {
      nip: {
        in: nips,
      },
    },
    select: {
      id: true,
      nip: true,
      unitId: true,
      user: {
        select: {
          id: true,
          role: true,
          isActive: true,
          authProvider: true,
        },
      },
    },
  });

  const existingByNip = new Map(
    existingEmployees.map((employee) => [employee.nip, employee]),
  );

  const missingCandidates = await tx.employee.findMany({
    where: {
      isPresentInSource: true,
      nip: {
        notIn: nips,
      },
    },
    select: {
      id: true,
      nip: true,
      user: {
        select: {
          id: true,
          isActive: true,
          authProvider: true,
        },
      },
    },
  });

  const missingLocalMutationCandidates = missingCandidates.filter(
    (employee) => employee.user !== null && isActiveNonSsoUser(employee.user),
  );

  if (missingLocalMutationCandidates.length > 0) {
    throw new EmployeeSnapshotValidationError(
      `Snapshot akan menonaktifkan User non-SSO yang masih aktif untuk NIP: ${missingLocalMutationCandidates
        .map((employee) => employee.nip)
        .join(", ")}`,
    );
  }

  const picUserIdsToDeactivate: string[] = [];

  for (const employee of snapshot.employees) {
    const unitId = unitIdByExternalCode.get(employee.externalUnitCode);

    if (!unitId) {
      throw new EmployeeSnapshotValidationError(
        `UnitExternalMapping tidak ditemukan untuk kode ${employee.externalUnitCode}`,
      );
    }

    const existing = existingByNip.get(employee.nip);

    if (!existing?.user) {
      continue;
    }

    const nextEmployee = {
      ...toEligibilityInput(employee),
      unitId,
    };

    if (!shouldDeactivateLinkedPicUser(existing, nextEmployee)) {
      continue;
    }

    if (existing.user.authProvider === "SSO") {
      if (existing.user.isActive) {
        picUserIdsToDeactivate.push(existing.user.id);
      }

      continue;
    }

    if (existing.user.isActive) {
      throw new EmployeeSnapshotValidationError(
        `Snapshot akan menonaktifkan User non-SSO yang masih aktif untuk NIP ${employee.nip}`,
      );
    }
  }

  const uniquePicUserIds = [...new Set(picUserIdsToDeactivate)];

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
        sourceCreatedAt: employee.sourceCreatedAt,
        sourceCreatedBy: employee.sourceCreatedBy,
        sourceUpdatedAt: employee.sourceUpdatedAt,
        sourceUpdatedBy: employee.sourceUpdatedBy,
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
        sourceCreatedAt: employee.sourceCreatedAt,
        sourceCreatedBy: employee.sourceCreatedBy,
        sourceUpdatedAt: employee.sourceUpdatedAt,
        sourceUpdatedBy: employee.sourceUpdatedBy,
        unitId,
        isPresentInSource: true,
        lastSeenAt: reconciliationAt,
        lastSeenSyncRunId: run.id,
      },
    });
  }

  const missingEmployeeIds = missingCandidates.map((employee) => employee.id);

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
): Promise<EmployeeSyncResult> {
  const reconciliationAt = new Date();

  try {
    const result = await prisma.$transaction(
      async (tx) =>
        reconcileWithinTransaction(tx, snapshot, run, reconciliationAt),
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

    return reconcileSnapshotForRun(run, snapshot);
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
