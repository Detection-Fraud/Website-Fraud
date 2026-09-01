import { z } from "zod";

export const categoryQuerySchema = z.object({
  targetUnit: z.enum(["KEGIATAN", "PARTISIPASI_PERSEN"]).optional(),
  evidenceMode: z
    .enum(["NONE", "PHOTO_WITH_AI", "PHOTO_WITHOUT_AI"])
    .optional(),
  scoreInputMode: z.enum(["NONE", "EXCEL_IMPORT", "DIRECT_ADMIN"]).optional(),
});

export const programPurposeSchema = z.enum(["EVIDENCE", "ALL"]).optional();

export const participationReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  tw: z.coerce.number().int().min(1).max(4).optional(),
  categoryId: z.string().uuid().optional(),
  participationType: z
    .enum(["ALL", "VALUE_ONLY", "WITH_EVIDENCE"])
    .default("ALL"),
  evidenceStatus: z
    .enum(["BELUM_UPLOAD", "PENDING", "APPROVED", "REJECTED"])
    .optional(),
  scoreStatus: z
    .enum(["MENUNGGU_APPROVAL", "MENUNGGU_NILAI", "SUDAH_DINILAI"])
    .optional(),
  unitId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ParticipationReportQuery = z.infer<
  typeof participationReportQuerySchema
>;
