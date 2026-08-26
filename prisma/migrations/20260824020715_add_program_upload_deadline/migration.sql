/*
  Warnings:

  - Added the required column `uploadDeadline` to the `ProgramBudaya` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProgramUnit" AS ENUM ('KEGIATAN', 'PARTISIPASI_PERSEN');

-- AlterTable
ALTER TABLE "ProgramBudaya" ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "tw" INTEGER,
ADD COLUMN     "uploadDeadline" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "frequency" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "ProgramCategory" ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "defaultFrequency" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "targetUnit" "ProgramUnit" NOT NULL DEFAULT 'KEGIATAN';

-- CreateTable
CREATE TABLE "ParticipationData" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "tw" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT,

    CONSTRAINT "ParticipationData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipationData_categoryId_idx" ON "ParticipationData"("categoryId");

-- CreateIndex
CREATE INDEX "ParticipationData_year_tw_idx" ON "ParticipationData"("year", "tw");

-- CreateIndex
CREATE INDEX "ParticipationData_unitId_idx" ON "ParticipationData"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationData_unitId_categoryId_tw_year_key" ON "ParticipationData"("unitId", "categoryId", "tw", "year");

-- CreateIndex
CREATE INDEX "ActivityPhoto_reportId_idx" ON "ActivityPhoto"("reportId");

-- CreateIndex
CREATE INDEX "ActivityReport_status_idx" ON "ActivityReport"("status");

-- CreateIndex
CREATE INDEX "ActivityReport_programId_idx" ON "ActivityReport"("programId");

-- CreateIndex
CREATE INDEX "ActivityReport_tanggalKegiatan_idx" ON "ActivityReport"("tanggalKegiatan");

-- CreateIndex
CREATE INDEX "ActivityReport_status_unitId_idx" ON "ActivityReport"("status", "unitId");

-- CreateIndex
CREATE INDEX "ActivityReport_unitId_programId_tanggalKegiatan_idx" ON "ActivityReport"("unitId", "programId", "tanggalKegiatan");

-- CreateIndex
CREATE INDEX "ProgramBudaya_isActive_idx" ON "ProgramBudaya"("isActive");

-- CreateIndex
CREATE INDEX "ProgramBudaya_categoryId_idx" ON "ProgramBudaya"("categoryId");

-- CreateIndex
CREATE INDEX "ProgramBudaya_tw_idx" ON "ProgramBudaya"("tw");

-- CreateIndex
CREATE INDEX "ProgramBudaya_startDate_endDate_uploadDeadline_idx" ON "ProgramBudaya"("startDate", "endDate", "uploadDeadline");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_authProvider_idx" ON "User"("authProvider");

-- CreateIndex
CREATE INDEX "User_unitId_idx" ON "User"("unitId");

-- AddForeignKey
ALTER TABLE "ParticipationData" ADD CONSTRAINT "ParticipationData_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationData" ADD CONSTRAINT "ParticipationData_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProgramCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationData" ADD CONSTRAINT "ParticipationData_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
