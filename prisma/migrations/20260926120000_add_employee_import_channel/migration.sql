-- Task 3: distinguish employee sync channels and store Excel preview metadata.
-- Existing EmployeeSyncRun rows default to PENTAHO.
-- Preview records contain hashes and lifecycle metadata only.

BEGIN;

CREATE TYPE "EmployeeSyncChannel" AS ENUM (
  'PENTAHO',
  'EXCEL_IMPORT'
);

ALTER TABLE "EmployeeSyncRun"
  ADD COLUMN "channel" "EmployeeSyncChannel" NOT NULL DEFAULT 'PENTAHO';

CREATE INDEX "EmployeeSyncRun_sourceSystem_channel_startedAt_idx"
  ON "EmployeeSyncRun" ("sourceSystem", "channel", "startedAt");

CREATE TABLE "EmployeeImportPreview" (
  "id" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "initiatedById" TEXT,
  "fileHash" CHAR(64) NOT NULL,
  "baselineRunId" TEXT,
  "impactHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmployeeImportPreview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeImportPreview_tokenHash_key"
  ON "EmployeeImportPreview" ("tokenHash");

CREATE INDEX "EmployeeImportPreview_initiatedById_expiresAt_idx"
  ON "EmployeeImportPreview" ("initiatedById", "expiresAt");

CREATE INDEX "EmployeeImportPreview_baselineRunId_idx"
  ON "EmployeeImportPreview" ("baselineRunId");

CREATE INDEX "EmployeeImportPreview_expiresAt_idx"
  ON "EmployeeImportPreview" ("expiresAt");

ALTER TABLE "EmployeeImportPreview"
  ADD CONSTRAINT "EmployeeImportPreview_initiatedById_fkey"
    FOREIGN KEY ("initiatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "EmployeeImportPreview_baselineRunId_fkey"
    FOREIGN KEY ("baselineRunId") REFERENCES "EmployeeSyncRun"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;