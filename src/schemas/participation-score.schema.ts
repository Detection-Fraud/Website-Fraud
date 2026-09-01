import { z } from "zod";

export const participationScoreSchema = z
  .object({
    percentage: z.number().int().min(0).max(100),
    changeReason: z.string().trim().max(500).optional(),
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .strict();

export type ParticipationScoreInput = z.infer<typeof participationScoreSchema>;
