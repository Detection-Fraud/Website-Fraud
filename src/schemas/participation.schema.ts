import { z } from "zod";

export const participationFilterSchema = z.object({
  categoryId: z.string().uuid("ID Kategori tidak valid"),
  tw: z.coerce.number().int().min(1).max(4, "TW harus antara 1-4"),
  year: z.coerce.number().int().min(2020).max(2100, "Tahun tidak valid"),
});

export const commitParticipationSchema = participationFilterSchema.extend({
  rows: z
    .array(
      z
        .object({
          unitId: z.string().uuid("Unit ID tidak valid"),
          percentage: z
            .number("Persentase harus berupa angka JSON")
            .int("Persentase harus bilangan bulat")
            .min(0, "Persentase minimal 0")
            .max(100, "Nilai Maksimal Persentase 100"),
          overwrite: z.boolean().default(false),
        })
        .strict(),
    )
    .min(1, "Data commit tidak boleh kosong"),
});

export const participationCorrectionSchema = participationFilterSchema
  .extend({
    rows: z
      .array(
        z
          .object({
            unitId: z.string().uuid("Unit ID tidak valid"),
            participantCount: z
              .number("Jumlah partisipasi harus berupa angka")
              .int("Jumlah partisipasi harus berupa bilangan bulat")
              .min(0, "Jumlah partisipasi tidak boleh negatif"),
            overwrite: z.boolean().default(false),
            reason: z
              .string("Alasan koreksi harus berupa teks")
              .trim()
              .max(500, "Alasan koreksi maksimal 500 karakter")
              .optional(),
            expectedUpdatedAt: z
              .string()
              .datetime("Versi data tidak valid")
              .optional(),
          })
          .strict(),
      )
      .min(1, "Data koreksi tidak boleh kosong"),
  })
  .superRefine((value, context) => {
    const unitIds = value.rows.map((row) => row.unitId);

    if (new Set(unitIds).size !== unitIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows"],
        message: "Unit tidak boleh duplikat dalam satu koreksi",
      });
    }

    value.rows.forEach((row, index) => {
      if (row.overwrite && !row.reason?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows", index, "reason"],
          message: "Alasan koreksi wajib diisi saat overwrite=true",
        });
      }
    });
  });

export type ParticipationCorrectionInput = z.infer<
  typeof participationCorrectionSchema
>;

export const participationSnapshotCommitSchema = participationFilterSchema
  .extend({
    rows: z
      .array(
        z
          .object({
            unitId: z.string().uuid("Unit ID tidak valid"),
            participantCount: z
              .number("Jumlah partisipasi harus berupa angka")
              .int("Jumlah partisipasi harus bilangan bulat")
              .min(0, "Jumlah partisipasi tidak boleh negatif"),
          })
          .strict(),
      )
      .min(1, "Data snapshot tidak boleh kosong"),
  })
  .superRefine((value, context) => {
    const unitIds = value.rows.map((row) => row.unitId);
    if (new Set(unitIds).size !== unitIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows"],
        message: "Unit tidak boleh duplikat dalam satu commit",
      });
    }
  });

export type ParticipationSnapshotCommitInput = z.infer<
  typeof participationSnapshotCommitSchema
>;

export type ParticipationFilterInput = z.infer<
  typeof participationFilterSchema
>;
export type CommitParticipationInput = z.infer<
  typeof commitParticipationSchema
>;
