/*
  Warnings:

  - You are about to drop the column `picKegiatan` on the `ActivityReport` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ActivityReport" DROP COLUMN "picKegiatan",
ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "ActivityReport_createdById_idx" ON "ActivityReport"("createdById");

-- AddForeignKey
ALTER TABLE "ActivityReport" ADD CONSTRAINT "ActivityReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
