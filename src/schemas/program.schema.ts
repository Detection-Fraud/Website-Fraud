import { z } from "zod";

export const createProgramSchema = z.object({
  name: z.string().min(3, "Nama program minimal 3 karakter"),
  description: z.string().optional(),
  frequency: z.coerce.number().int().positive("Frekuensi harus lebih dari 0"),
  startDate: z.coerce.date({ message: "Format tanggal mulai tidak valid" }),
  endDate: z.coerce.date({ message: "Format tanggal selesai tidak valid" }),
  categoryId: z.string().uuid("Category ID tidak valid").optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = createProgramSchema.partial();
