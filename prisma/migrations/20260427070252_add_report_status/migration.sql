-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ActivityReport" ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PENDING';
