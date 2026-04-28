/*
  Warnings:

  - The values [REGION,BRANCH,DIVISION] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `ActivityReport` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `claimedCount` on the `ActivityReport` table. All the data in the column will be lost.
  - You are about to drop the column `quarterPeriod` on the `ActivityReport` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `ActivityReport` table. All the data in the column will be lost.
  - You are about to drop the column `nama` on the `Region` table. All the data in the column will be lost.
  - Added the required column `description` to the `ActivityReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lokasi` to the `ActivityReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `picKegiatan` to the `ActivityReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tanggalKegiatan` to the `ActivityReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Region` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'PIC', 'VIEWER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;

-- DropForeignKey
ALTER TABLE "ActivityPhoto" DROP CONSTRAINT "ActivityPhoto_reportId_fkey";

-- AlterTable
ALTER TABLE "ActivityPhoto" ALTER COLUMN "reportId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "ActivityReport" DROP CONSTRAINT "ActivityReport_pkey",
DROP COLUMN "claimedCount",
DROP COLUMN "quarterPeriod",
DROP COLUMN "year",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "lokasi" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "picKegiatan" TEXT NOT NULL,
ADD COLUMN     "programId" TEXT,
ADD COLUMN     "tanggalKegiatan" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ActivityReport_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ActivityReport_id_seq";

-- AlterTable
ALTER TABLE "Region" DROP COLUMN "nama",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'VIEWER';

-- CreateTable
CREATE TABLE "ProgramBudaya" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramBudaya_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ActivityReport" ADD CONSTRAINT "ActivityReport_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ProgramBudaya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPhoto" ADD CONSTRAINT "ActivityPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ActivityReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
