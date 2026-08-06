import { z } from "zod";

export const participationFilterSchema = z.object({
  categoryId: z.string().uuid("ID Kategori tidak valid"),
  tw: z.coerce.number().int().min(1).max(4, "TW harus antara 1-4"),
  year: z.coerce.number().int().min(2020).max(2100, "Tahun tidak valid"),
});

export const commitParticipationSchema = participationFilterSchema.extend({
  rows: z
    .array(
      z.object({
        unitId: z.string().uuid("Unit ID tidak valid"),
        percentage: z.number().int().min(0, "Persentase minimal 0"),
        overwrite: z.boolean().default(false),
      }),
    )
    .min(1, "Data commit tidak boleh kosong"),
});

export type ParticipationFilterInput = z.infer<
  typeof participationFilterSchema
>;
export type CommitParticipationInput = z.infer<
  typeof commitParticipationSchema
>;
