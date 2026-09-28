import { z } from "zod";

export const employeeImportCommitSchema = z
  .object({
    previewToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    confirmFullSnapshot: z.literal("true"),
  })
  .strict();

export const employeeImportImpactSchema = z
  .object({
    newCount: z.number().int().nonnegative(),
    changedCount: z.number().int().nonnegative(),
    unchangedCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative(),
    deactivationCount: z.number().int().nonnegative(),
    details: z.array(
      z.object({
        nip: z.string().max(64),
        change: z.enum(["NEW", "CHANGED", "UNCHANGED", "MISSING", "DEACTIVATION"]),
      }).strict(),
    ).max(100),
  })
  .strict();

export const employeeImportPreviewSchema = z
  .object({
    previewToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expiresAt: z.string().datetime({ offset: true }),
    rowCount: z.number().int().positive().max(100_000),
    impact: employeeImportImpactSchema,
  })
  .strict();

export const employeeImportRunResponseSchema = z
  .object({
    runId: z.string().uuid(),
    sourceSystem: z.literal("PENTAHO"),
    channel: z.literal("EXCEL_IMPORT"),
    status: z.enum(["SUCCEEDED", "FAILED"]),
    receivedCount: z.number().int().nonnegative(),
    processedCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative(),
    deactivatedCount: z.number().int().nonnegative(),
  })
  .strict();

export type EmployeeImportImpact = z.infer<typeof employeeImportImpactSchema>;
