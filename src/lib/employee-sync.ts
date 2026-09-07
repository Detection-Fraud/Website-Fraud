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

export type ExistingEmployeeForSync = {
  unitId: string | null;
  user: {
    id: string;
    role: "ADMIN" | "PIC" | "VIEWER";
    isActive: boolean;
  } | null;
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
): Prisma.InputJsonValue | undefined {
  if (snapshot.sourceMetadata === undefined) {
    return undefined;
  }

  return snapshot.sourceMetadata as Prisma.InputJsonValue;
}

export async function syncEmployeeSnapshot(input: unknown): Promise<{
  runId: string;
  sourceSystem: string;
  receivedCount: number;
  processedCount: number;
  missingCount: number;
  deactivatedCount: number;
}> {
  const snapshot = parseEmployeeSnapshot(input);
  const sourceMetadata = toSourceMetadata(snapshot);

  const run = await prisma.employeeSyncRun.create({
    data: {
      sourceSystem: snapshot.sourceSystem,
      sourceMetadata,
      status: "RUNNING",
      receivedCount: snapshot.employees.length,
    },
    select: {
      id: true,
    },
  });

  const nips = snapshot.employees.map((employee) => employee.nip);
  const externalUnitCodes = [
    ...new Set(snapshot.employees.map((employee) => employee.externalUnitCode)),
  ];

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const mappings = await tx.unitExternalMapping.findMany({
          where: {
            sourceSystem: snapshot.sourceSystem,
            externalUnitCode: {
              in: externalUnitCodes,
            },
          },
          select: {
            externalUnitCode: true,
            unitId: true,
          },
        });

        const unitIdByExternalCode = new Map(
          mappings.map((mapping) => [mapping.externalUnitCode, mapping.unitId]),
        );

        const missingUnitCodes = externalUnitCodes.filter(
          (externalUnitCode) => !unitIdByExternalCode.has(externalUnitCode),
        );

        if (missingUnitCodes.length > 0) {
          throw new EmployeeSnapshotValidationError(
            `UnitExternalMapping tidak ditemukan untuk sourceSystem=${snapshot.sourceSystem}: ${missingUnitCodes.join(", ")}`,
          );
        }

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
              },
            },
          },
        });

        const existingByNip = new Map(
          existingEmployees.map((employee) => [employee.nip, employee]),
        );

        let deactivatedCount = 0;
        let processedCount = 0;

        for (const employee of snapshot.employees) {
          const unitId = unitIdByExternalCode.get(employee.externalUnitCode);

          if (!unitId) {
            throw new EmployeeSnapshotValidationError(
              `UnitExternalMapping tidak ditemukan untuk kode ${employee.externalUnitCode}`,
            );
          }

          const existing = existingByNip.get(employee.nip);
          const nextEmployee = {
            ...toEligibilityInput(employee),
            unitId,
          };

          if (
            existing &&
            existing.user &&
            shouldDeactivateLinkedPicUser(existing, nextEmployee)
          ) {
            await tx.user.update({
              where: {
                id: existing.user.id,
              },
              data: {
                isActive: false,
              },
            });

            deactivatedCount += 1;
          }

          await tx.employee.upsert({
            where: {
              nip: employee.nip,
            },
            create: {
              nip: employee.nip,
              name: employee.name,
              jenjang: employee.jenjang,
              kodeStatpeg: employee.kodeStatpeg,
              statKepeg: employee.statKepeg,
              unitId,
              isPresentInSource: true,
              lastSeenAt: new Date(),
              lastSeenSyncRunId: run.id,
            },
            update: {
              name: employee.name,
              jenjang: employee.jenjang,
              kodeStatpeg: employee.kodeStatpeg,
              statKepeg: employee.statKepeg,
              unitId,
              isPresentInSource: true,
              lastSeenAt: new Date(),
              lastSeenSyncRunId: run.id,
            },
          });

          processedCount += 1;
        }

        const missingWhere = nips.length
          ? {
              isPresentInSource: true,
              nip: {
                notIn: nips,
              },
            }
          : {
              isPresentInSource: true,
            };

        const missingEmployees = await tx.employee.updateMany({
          where: missingWhere,
          data: {
            isPresentInSource: false,
          },
        });

        const missingUsers = await tx.user.updateMany({
          where: {
            employee: {
              is: {
                isPresentInSource: false,
              },
            },
          },
          data: {
            isActive: false,
          },
        });

        const totalDeactivatedCount = deactivatedCount + missingUsers.count;

        await tx.employeeSyncRun.update({
          where: {
            id: run.id,
          },
          data: {
            status: "SUCCEEDED",
            completedAt: new Date(),
            processedCount,
            missingCount: missingEmployees.count,
            errorMessage: null,
          },
        });

        return {
          processedCount,
          missingCount: missingEmployees.count,
          deactivatedCount: totalDeactivatedCount,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      runId: run.id,
      sourceSystem: snapshot.sourceSystem,
      receivedCount: snapshot.employees.length,
      ...result,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message.slice(0, 2_000)
        : "Employee snapshot reconciliation failed";

    await prisma.employeeSyncRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage,
      },
    });

    throw error;
  }
}
