import { z } from "zod";

export const employeeSyncRunIdSchema = z.string().uuid("Run ID tidak valid");

export const employeeSyncStatusSchema = z
  .object({
    runId: z.string().uuid(),
    sourceSystem: z.string().min(1).max(64),
    status: z.enum(["RUNNING", "SUCCEEDED", "FAILED"]),
    phase: z
      .enum([
        "TRIGGERING",
        "PENTAHO_RUNNING",
        "VALIDATING",
        "RECONCILING",
        "COMPLETED",
      ])
      .nullable(),
    startedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }).nullable(),
    deadlineAt: z.string().datetime({ offset: true }).nullable(),
    receivedCount: z.number().int().nonnegative(),
    processedCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative(),
    deactivatedCount: z.number().int().nonnegative(),
    errorMessage: z.string().max(128).nullable(),
    canStart: z.boolean(),
  })
  .strict();

export type EmployeeSyncStatusResponse = z.infer<typeof employeeSyncStatusSchema>;

