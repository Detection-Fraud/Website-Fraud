-- Task 1: additive Employee/Pentaho provenance and participation snapshot model.
-- Legacy participation counts remain NULL; existing percentages are converted losslessly.

CREATE TYPE "EmployeeSyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ParticipationProvenance" AS ENUM ('LEGACY', 'EMPLOYEE_SNAPSHOT');

CREATE TABLE "EmployeeSyncRun" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceMetadata" JSONB,
    "status" "EmployeeSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "receivedCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jenjang" TEXT NOT NULL,
    "kodeStatpeg" TEXT NOT NULL,
    "statKepeg" TEXT NOT NULL,
    "unitId" TEXT,
    "isPresentInSource" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "lastSeenSyncRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_nip_key" ON "Employee"("nip");
CREATE INDEX "Employee_unitId_idx" ON "Employee"("unitId");
CREATE INDEX "Employee_isPresentInSource_idx" ON "Employee"("isPresentInSource");
CREATE INDEX "Employee_jenjang_kodeStatpeg_statKepeg_isPresentInSource_idx"
  ON "Employee"("jenjang", "kodeStatpeg", "statKepeg", "isPresentInSource");

CREATE TABLE "UnitExternalMapping" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "externalUnitCode" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnitExternalMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnitExternalMapping_sourceSystem_externalUnitCode_key"
  ON "UnitExternalMapping"("sourceSystem", "externalUnitCode");
CREATE INDEX "UnitExternalMapping_unitId_idx" ON "UnitExternalMapping"("unitId");

CREATE TABLE "ParticipationCorrectionAudit" (
    "id" TEXT NOT NULL,
    "participationDataId" TEXT NOT NULL,
    "previousParticipantCount" INTEGER,
    "newParticipantCount" INTEGER NOT NULL,
    "previousPercentage" DECIMAL(5,2),
    "newPercentage" DECIMAL(5,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParticipationCorrectionAudit_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ParticipationData"
    WHERE "percentage" IS NOT NULL AND ("percentage" < 0 OR "percentage" > 100)
  ) OR EXISTS (
    SELECT 1 FROM "ParticipationScoreHistory"
    WHERE "previousPercentage" IS NOT NULL AND ("previousPercentage" < 0 OR "previousPercentage" > 100)
       OR "newPercentage" < 0 OR "newPercentage" > 100
  ) THEN
    RAISE EXCEPTION 'Existing participation percentages must be between 0 and 100';
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN "employeeId" TEXT;
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

ALTER TABLE "ParticipationData"
  ADD COLUMN "headcount" INTEGER,
  ADD COLUMN "participantCount" INTEGER,
  ADD COLUMN "provenance" "ParticipationProvenance" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "employeeSyncRunId" TEXT,
  ADD COLUMN "headcountCapturedAt" TIMESTAMP(3),
  ADD COLUMN "unitNameSnapshot" TEXT,
  ADD COLUMN "parentUnitNameSnapshot" TEXT,
  ADD COLUMN "categoryNameSnapshot" TEXT;

ALTER TABLE "ParticipationData"
  ALTER COLUMN "percentage" TYPE DECIMAL(5,2)
  USING "percentage"::DECIMAL(5,2);

ALTER TABLE "ParticipationScoreHistory"
  ALTER COLUMN "previousPercentage" TYPE DECIMAL(5,2)
  USING "previousPercentage"::DECIMAL(5,2),
  ALTER COLUMN "newPercentage" TYPE DECIMAL(5,2)
  USING "newPercentage"::DECIMAL(5,2);

ALTER TABLE "ParticipationData" DROP CONSTRAINT "ParticipationData_unitId_fkey";
ALTER TABLE "ParticipationData" DROP CONSTRAINT "ParticipationData_categoryId_fkey";
ALTER TABLE "ParticipationData" DROP CONSTRAINT "ParticipationData_importedById_fkey";

ALTER TABLE "ParticipationData"
  ADD CONSTRAINT "ParticipationData_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ParticipationData_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ProgramCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ParticipationData_importedById_fkey"
    FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ParticipationData_employeeSyncRunId_fkey"
    FOREIGN KEY ("employeeSyncRunId") REFERENCES "EmployeeSyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Employee_lastSeenSyncRunId_fkey"
    FOREIGN KEY ("lastSeenSyncRunId") REFERENCES "EmployeeSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD CONSTRAINT "User_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UnitExternalMapping"
  ADD CONSTRAINT "UnitExternalMapping_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ParticipationCorrectionAudit"
  ADD CONSTRAINT "ParticipationCorrectionAudit_participationDataId_fkey"
    FOREIGN KEY ("participationDataId") REFERENCES "ParticipationData"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ParticipationCorrectionAudit_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EmployeeSyncRun_status_idx" ON "EmployeeSyncRun"("status");
CREATE INDEX "EmployeeSyncRun_startedAt_idx" ON "EmployeeSyncRun"("startedAt");
CREATE INDEX "EmployeeSyncRun_status_completedAt_idx" ON "EmployeeSyncRun"("status", "completedAt");
CREATE INDEX "ParticipationData_employeeSyncRunId_idx" ON "ParticipationData"("employeeSyncRunId");
CREATE INDEX "ParticipationCorrectionAudit_participationDataId_createdAt_idx"
  ON "ParticipationCorrectionAudit"("participationDataId", "createdAt");
CREATE INDEX "ParticipationCorrectionAudit_actorId_idx" ON "ParticipationCorrectionAudit"("actorId");

ALTER TABLE "ParticipationData"
  ADD CONSTRAINT "ParticipationData_headcount_nonnegative_check"
    CHECK ("headcount" IS NULL OR "headcount" >= 0),
  ADD CONSTRAINT "ParticipationData_participantCount_nonnegative_check"
    CHECK ("participantCount" IS NULL OR "participantCount" >= 0),
  ADD CONSTRAINT "ParticipationData_participantCount_headcount_check"
    CHECK ("participantCount" IS NULL OR "headcount" IS NULL OR "participantCount" <= "headcount");

ALTER TABLE "ParticipationCorrectionAudit"
  ADD CONSTRAINT "ParticipationCorrectionAudit_counts_nonnegative_check"
    CHECK ("previousParticipantCount" IS NULL OR "previousParticipantCount" >= 0),
  ADD CONSTRAINT "ParticipationCorrectionAudit_newParticipantCount_nonnegative_check"
    CHECK ("newParticipantCount" >= 0),
  ADD CONSTRAINT "ParticipationCorrectionAudit_percentages_range_check"
    CHECK (("previousPercentage" IS NULL OR "previousPercentage" BETWEEN 0 AND 100)
      AND "newPercentage" BETWEEN 0 AND 100);

ALTER TABLE "ParticipationScoreHistory"
  ADD CONSTRAINT "ParticipationScoreHistory_percentage_range_check"
    CHECK (("previousPercentage" IS NULL OR "previousPercentage" BETWEEN 0 AND 100)
      AND "newPercentage" BETWEEN 0 AND 100);