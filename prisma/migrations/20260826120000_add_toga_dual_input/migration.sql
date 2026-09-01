-- Preflight: legacy participation percentages must be valid before the range
-- constraint is added. Invalid data must be corrected deliberately, not clamped.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ParticipationData"
    WHERE "percentage" < 0 OR "percentage" > 100
  ) THEN
    RAISE EXCEPTION 'ParticipationData contains percentage values outside 0-100';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "EvidenceMode" AS ENUM ('NONE', 'PHOTO_WITH_AI', 'PHOTO_WITHOUT_AI');
CREATE TYPE "ScoreInputMode" AS ENUM ('NONE', 'EXCEL_IMPORT', 'DIRECT_ADMIN');
CREATE TYPE "ScoreHistoryAction" AS ENUM ('CREATED', 'UPDATED');

-- Add category capabilities as nullable first so existing rows can be
-- backfilled according to their established target-unit behavior.
ALTER TABLE "ProgramCategory"
  ADD COLUMN "evidenceMode" "EvidenceMode",
  ADD COLUMN "scoreInputMode" "ScoreInputMode";

UPDATE "ProgramCategory"
SET
  "evidenceMode" = CASE
    WHEN "targetUnit" = 'KEGIATAN' THEN 'PHOTO_WITH_AI'::"EvidenceMode"
    ELSE 'NONE'::"EvidenceMode"
  END,
  "scoreInputMode" = CASE
    WHEN "targetUnit" = 'PARTISIPASI_PERSEN' THEN 'EXCEL_IMPORT'::"ScoreInputMode"
    ELSE 'NONE'::"ScoreInputMode"
  END;

ALTER TABLE "ProgramCategory"
  ALTER COLUMN "evidenceMode" SET NOT NULL,
  ALTER COLUMN "evidenceMode" SET DEFAULT 'PHOTO_WITH_AI',
  ALTER COLUMN "scoreInputMode" SET NOT NULL,
  ALTER COLUMN "scoreInputMode" SET DEFAULT 'NONE';

-- Add direct-assessment fields without changing existing Excel participation
-- rows. updatedAt is backfilled before it becomes required.
ALTER TABLE "ParticipationData"
  ALTER COLUMN "percentage" DROP NOT NULL,
  ADD COLUMN "evidenceReportId" TEXT,
  ADD COLUMN "assessedById" TEXT,
  ADD COLUMN "assessedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "ParticipationData"
SET "updatedAt" = "importedAt"
WHERE "updatedAt" IS NULL;

ALTER TABLE "ParticipationData"
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ADD CONSTRAINT "ParticipationData_percentage_range_check"
    CHECK ("percentage" IS NULL OR "percentage" BETWEEN 0 AND 100);

-- Immutable administrator-only score audit trail.
CREATE TABLE "ParticipationScoreHistory" (
  "id" TEXT NOT NULL,
  "participationDataId" TEXT NOT NULL,
  "evidenceReportId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "action" "ScoreHistoryAction" NOT NULL,
  "previousPercentage" INTEGER,
  "newPercentage" INTEGER NOT NULL,
  "changeReason" TEXT,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParticipationScoreHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParticipationData_evidenceReportId_key"
  ON "ParticipationData"("evidenceReportId");
CREATE INDEX "ParticipationScoreHistory_participationDataId_createdAt_idx"
  ON "ParticipationScoreHistory"("participationDataId", "createdAt");
CREATE INDEX "ParticipationScoreHistory_evidenceReportId_idx"
  ON "ParticipationScoreHistory"("evidenceReportId");
CREATE INDEX "ParticipationScoreHistory_categoryId_idx"
  ON "ParticipationScoreHistory"("categoryId");

ALTER TABLE "ParticipationData"
  ADD CONSTRAINT "ParticipationData_evidenceReportId_fkey"
    FOREIGN KEY ("evidenceReportId") REFERENCES "ActivityReport"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ParticipationData_assessedById_fkey"
    FOREIGN KEY ("assessedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ParticipationScoreHistory"
  ADD CONSTRAINT "ParticipationScoreHistory_participationDataId_fkey"
    FOREIGN KEY ("participationDataId") REFERENCES "ParticipationData"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ParticipationScoreHistory_evidenceReportId_fkey"
    FOREIGN KEY ("evidenceReportId") REFERENCES "ActivityReport"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ParticipationScoreHistory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ProgramCategory"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ParticipationScoreHistory_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
