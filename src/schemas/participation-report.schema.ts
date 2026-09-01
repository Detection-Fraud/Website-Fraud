import { z } from "zod";

export const participationReportQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(new Date().getFullYear()),
  tw: z.coerce.number().int().min(1).max(4).optional(),
  categoryId: z.string().uuid("Category ID tidak valid").optional(),
  participationType: z
    .enum(["ALL", "VALUE_ONLY", "WITH_EVIDENCE"])
    .default("WITH_EVIDENCE"),
  evidenceStatus: z
    .enum([
      "ALL",
      "BELUM_UPLOAD",
      "PENDING",
      "REJECTED",
      "APPROVED_BELUM_DINILAI",
      "SELESAI",
    ])
    .default("ALL"),
  scoreStatus: z.enum(["ALL", "BELUM_DINILAI", "SELESAI"]).default("ALL"),
  kanwilId: z
    .string()
    .uuid("Kanwil ID tidak valid")
    .or(z.literal("ALL"))
    .default("ALL"),
  kancabId: z
    .string()
    .uuid("Kancab ID tidak valid")
    .or(z.literal("ALL"))
    .default("ALL"),
  divisiId: z
    .string()
    .uuid("Divisi ID tidak valid")
    .or(z.literal("ALL"))
    .default("ALL"),
  unitType: z
    .enum(["NASIONAL", "KANWIL_AND_KANCAB", "KANWIL", "KANCAB", "DIVISI"])
    .default("NASIONAL"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type ParticipationReportQuery = z.infer<
  typeof participationReportQuerySchema
>;
