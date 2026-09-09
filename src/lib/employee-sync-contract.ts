import { z } from "zod";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function isJsonCompatible(value: unknown, seen = new WeakSet<object>): boolean {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;

  if (seen.has(value)) return false;
  seen.add(value);

  const prototype = Object.getPrototypeOf(value);
  const compatible = Array.isArray(value)
    ? value.every((child) => isJsonCompatible(child, seen))
    : (prototype === Object.prototype || prototype === null) &&
      Object.values(value).every((child) => isJsonCompatible(child, seen));

  seen.delete(value);
  return compatible;
}

const jsonValueSchema = z.custom<JsonValue>(isJsonCompatible, {
  message: "sourceMetadata harus berisi nilai JSON yang kompatibel",
});

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
    sourceMetadata: z.record(z.string(), jsonValueSchema).optional(),
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
