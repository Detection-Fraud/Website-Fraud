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

export const createProgramSchema = z.object({
  name: z.string().min(3, "Nama program minimal 3 karakter"),
  description: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable().or(z.literal("")),
  frequency: z.coerce.number().int().min(1, "Target TW minimal 1"),
  tw: z.coerce.number().int().min(1).max(4).optional().nullable(),
  startDate: z.coerce.date({ message: "Format tanggal mulai tidak valid" }),
  endDate: z.coerce.date({ message: "Format tanggal selesai tidak valid" }),
  categoryId: z.string().uuid("Category ID tidak valid").optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = createProgramSchema.partial();
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
