/*
  Warnings:

  - You are about to drop the column `branchId` on the `ActivityReport` table. All the data in the column will be lost.
  - You are about to drop the column `divisionId` on the `ActivityReport` table. All the data in the column will be lost.
  - You are about to drop the column `regionId` on the `ActivityReport` table. All the data in the column will be lost.
  - You are about to drop the column `branchId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `divisionId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `regionId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Branch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Division` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Region` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('DIVISI', 'KANTOR_WILAYAH', 'KANTOR_CABANG');

-- DropForeignKey
ALTER TABLE "ActivityReport" DROP CONSTRAINT "ActivityReport_branchId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityReport" DROP CONSTRAINT "ActivityReport_divisionId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityReport" DROP CONSTRAINT "ActivityReport_regionId_fkey";

-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_regionId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_branchId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_divisionId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_regionId_fkey";

-- DropIndex
DROP INDEX "ActivityReport_branchId_idx";

-- DropIndex
DROP INDEX "ActivityReport_divisionId_idx";

-- DropIndex
DROP INDEX "ActivityReport_regionId_idx";

-- AlterTable
ALTER TABLE "ActivityReport" DROP COLUMN "branchId",
DROP COLUMN "divisionId",
DROP COLUMN "regionId",
ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "branchId",
DROP COLUMN "divisionId",
DROP COLUMN "regionId",
ADD COLUMN     "unitId" TEXT;

-- DropTable
DROP TABLE "Branch";

-- DropTable
DROP TABLE "Division";

-- DropTable
DROP TABLE "Region";

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "kodeDolog" TEXT NOT NULL,
    "kodeSubdolog" TEXT NOT NULL,
    "kodeOrg" TEXT NOT NULL,
    "kodeDivisi" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_kodeOrg_key" ON "Unit"("kodeOrg");

-- CreateIndex
CREATE INDEX "Unit_type_idx" ON "Unit"("type");

-- CreateIndex
CREATE INDEX "Unit_kodeDolog_kodeSubdolog_idx" ON "Unit"("kodeDolog", "kodeSubdolog");

-- CreateIndex
CREATE INDEX "Unit_parentId_idx" ON "Unit"("parentId");

-- CreateIndex
CREATE INDEX "ActivityReport_unitId_idx" ON "ActivityReport"("unitId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReport" ADD CONSTRAINT "ActivityReport_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
