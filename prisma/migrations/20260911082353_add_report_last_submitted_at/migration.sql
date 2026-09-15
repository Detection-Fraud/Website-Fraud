ALTER TABLE "ActivityReport"
ADD COLUMN "lastSubmittedAt" TIMESTAMP(3);

UPDATE "ActivityReport" AS report
SET "lastSubmittedAt" = COALESCE(
  (
    SELECT MAX(log."createdAt")
    FROM "ActivityLog" AS log
    WHERE log."reportId" = report."id"
      AND log."action" IN (
        'SUBMITTED'::"ActivityAction",
        'RESUBMITTED'::"ActivityAction"
      )
  ),
  report."createdAt"
);

ALTER TABLE "ActivityReport"
ALTER COLUMN "lastSubmittedAt" SET NOT NULL;

ALTER TABLE "ActivityReport"
ALTER COLUMN "lastSubmittedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ActivityReport_status_lastSubmittedAt_id_idx"
ON "ActivityReport"("status", "lastSubmittedAt", "id");