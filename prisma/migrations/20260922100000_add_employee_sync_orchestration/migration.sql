-- Task 3: durable Pentaho orchestration state and current-state staging mirror.
-- This migration is additive. It never rewrites existing EmployeeSyncRun history.

DO $$
DECLARE
  duplicate_source TEXT;
BEGIN
  SELECT "sourceSystem"
    INTO duplicate_source
  FROM "EmployeeSyncRun"
  WHERE "status" = 'RUNNING'
  GROUP BY "sourceSystem"
  HAVING COUNT(*) > 1
  ORDER BY "sourceSystem"
  LIMIT 1;

  IF duplicate_source IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce one RUNNING EmployeeSyncRun per source: sourceSystem "%" already has multiple RUNNING rows; resolve the duplicate rows before applying this migration. Historical run state was not rewritten.',
      duplicate_source;
  END IF;
END $$;

CREATE TYPE "EmployeeSyncPhase" AS ENUM (
  'TRIGGERING',
  'PENTAHO_RUNNING',
  'VALIDATING',
  'RECONCILING',
  'COMPLETED'
);

ALTER TABLE "EmployeeSyncRun"
  ADD COLUMN "phase" "EmployeeSyncPhase",
  ADD COLUMN "externalJobName" TEXT,
  ADD COLUMN "triggeredById" TEXT,
  ADD COLUMN "triggeredByName" TEXT,
  ADD COLUMN "deadlineAt" TIMESTAMP(3),
  ADD COLUMN "deactivatedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EmployeeSyncRun"
  ADD CONSTRAINT "EmployeeSyncRun_triggeredById_fkey"
    FOREIGN KEY ("triggeredById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EmployeeSyncRun_externalJobName_key"
  ON "EmployeeSyncRun" ("externalJobName");

CREATE UNIQUE INDEX "EmployeeSyncRun_one_running_per_source"
  ON "EmployeeSyncRun" ("sourceSystem")
  WHERE "status" = 'RUNNING';

CREATE INDEX "EmployeeSyncRun_sourceSystem_startedAt_idx"
  ON "EmployeeSyncRun" ("sourceSystem", "startedAt");

CREATE SCHEMA IF NOT EXISTS "pentaho_stage";

CREATE TABLE "pentaho_stage"."employee_mirror" (
  "nip" TEXT NOT NULL,
  "nama" TEXT NOT NULL,
  "jab_lkp" TEXT NOT NULL,
  "kode_statpeg" TEXT NOT NULL,
  "stat_kepeg" TEXT NOT NULL,
  "kode_dolog" TEXT NOT NULL,
  "kode_subdolog" TEXT NOT NULL,
  "kode_kansilog" TEXT NOT NULL,
  "kode_gudang" TEXT NOT NULL,
  "kode_org" TEXT NOT NULL,
  "jenjang" TEXT NOT NULL,
  "nama_org" TEXT NOT NULL,
  "nama_satker" TEXT NOT NULL,
  "nama_induk" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL,
  "created_by" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "updated_by" TEXT NOT NULL,
  CONSTRAINT "employee_mirror_pkey" PRIMARY KEY ("nip")
);
