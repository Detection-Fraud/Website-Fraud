import { z } from "zod";

const optionalSearch = z
  .string()
  .trim()
  .max(100, "Search maksimal 100 karakter")
  .optional();

export const listEmployeesQuerySchema = z.object({
  search: optionalSearch,
  source: z.enum(["PRESENT", "ABSENT"]).optional(),
  employment: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  account: z.enum(["LINKED", "UNLINKED", "ACTIVE", "INACTIVE"]).optional(),
  role: z.enum(["ADMIN", "PIC", "VIEWER"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
