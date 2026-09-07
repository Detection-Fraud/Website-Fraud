import { z } from "zod";

const normalizedEmployeeSchema = z
  .object({
    nip: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(200),
    jenjang: z.string().trim().min(1).max(32),
    kodeStatpeg: z.string().trim().min(1).max(32),
    statKepeg: z.string().trim().min(1).max(32),
    externalUnitCode: z.string().trim().min(1).max(128),
  })
  .strict();

export const employeeSnapshotSchema = z
  .object({
    sourceSystem: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9._:-]+$/),
    sourceMetadata: z.record(z.string(), z.unknown()).optional(),
    employees: z.array(normalizedEmployeeSchema).max(100_000),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const seenNips = new Map<string, number>();
    snapshot.employees.forEach((employee, index) => {
      const firstIndex = seenNips.get(employee.nip);

      if (firstIndex !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["employees", index, "nip"],
          message: `NIP duplikat; baris pertama berada pada indeks ${firstIndex}`,
        });
        return;
      }

      seenNips.set(employee.nip, index);
    });
  });

export type NormalizedEmployee = z.infer<typeof normalizedEmployeeSchema>;

export type NormalizedEmployeeSnapshot = z.infer<typeof employeeSnapshotSchema>;

export function parseEmployeeSnapshot(
  input: unknown,
): NormalizedEmployeeSnapshot {
  return employeeSnapshotSchema.parse(input);
}
