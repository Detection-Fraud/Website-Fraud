import { z } from "zod";

export const createReportSchema = z.object({
  activityName: z.string().min(5, "Nama aktivitas minimal 5 karakter").max(255),
  tanggalKegiatan: z.coerce.date({
    message: "Format tanggal tidak valid",
  }),
  lokasi: z.string().min(3, "Lokasi minimal 3 karakter"),
  description: z.string().min(10, "Deskripsi minimal 10 karakter"),
  programId: z.uuid("Program ID tidak valid"),
  uploadedPhotos: z.array(
    z.object({
      originalName: z.string(),
      imageUrl: z.string().min(1, "URL foto tidak valid"),
    }),
  ),
});

export const reviewReportSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"], {
      message: "Status harus APPROVED atau REJECTED",
    }),
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "REJECTED") {
      if (!data.notes || data.notes.trim().length < 10) {
        ctx.addIssue({
          code: "custom",
          path: ["notes"],
          message: "Catatan penolakan wajib diisi minimal 10 karakter",
        });
      }
    }
  });

export const updateReportSchema = z.object({
  activityName: z
    .string()
    .min(5, "Nama aktivitas minimal 5 karakter")
    .max(255)
    .optional(),
  tanggalKegiatan: z.coerce
    .date({ message: "Format tanggal tidak valid" })
    .optional(),
  lokasi: z.string().min(3, "Lokasi minimal 3 karakter").optional(),
  description: z.string().min(10, "Deskripsi minimal 10 karakter").optional(),
  programId: z.string().uuid("Program ID tidak valid").optional().nullable(),
  photos: z
    .array(
      z.object({
        imageUrl: z.string().min(1, "URL foto tidak valid"),
        originalName: z.string(),
        publicId: z.string().optional().nullable(),
      }),
    )
    .optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;
