import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter"),
  color: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable().or(z.literal("")),
  targetUnit: z.enum(["KEGIATAN", "PARTISIPASI_PERSEN"]).default("KEGIATAN"),
  defaultFrequency: z.coerce
    .number()
    .int()
    .min(1, "Target minimal 1")
    .default(1),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

const programFieldsSchema = z.object({
  name: z.string().trim().min(3, "Nama program minimal 3 karakter"),
  description: z.string().trim().optional().nullable(),
  bannerUrl: z.string().optional().nullable().or(z.literal("")),
  frequency: z.coerce.number().int().min(1, "Target TW minimal 1"),
  tw: z.coerce.number().int().min(1).max(4, "TW harus 1-4"),
  startDate: z.coerce.date({ message: "Format tanggal mulai tidak valid" }),
  endDate: z.coerce.date({ message: "Format tanggal selesai tidak valid" }),
  uploadDeadline: z.coerce.date({
    message: "Format deadline upload tidak valid",
  }),
  categoryId: z.string().uuid("Category ID tidak valid").optional().nullable(),
  isActive: z.boolean().optional(),
});

type PeriodInput = Partial<z.infer<typeof programFieldsSchema>>;

function validatePeriod(data: PeriodInput, ctx: z.RefinementCtx) {
  const { startDate, endDate, uploadDeadline } = data;

  if (startDate && endDate && startDate > endDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
    });
  }

  if (
    startDate &&
    endDate &&
    startDate.getUTCFullYear() !== endDate.getUTCFullYear()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "Periode kegiatan harus berada dalam satu tahun",
    });
  }

  if (endDate && uploadDeadline && endDate > uploadDeadline) {
    ctx.addIssue({
      code: "custom",
      path: ["uploadDeadline"],
      message: "Deadline upload tidak boleh sebelum tanggal selesai kegiatan",
    });
  }
}

export const createProgramSchema =
  programFieldsSchema.superRefine(validatePeriod);
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = programFieldsSchema
  .partial()
  .superRefine(validatePeriod);
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

export const toggleProgramSchema = z.object({ isActive: z.boolean() });
