/*
  Warnings:

  - You are about to drop the column `description` on the `ProgramBudaya` table. All the data in the column will be lost.
  - Added the required column `endDate` to the `ProgramBudaya` table without a default value. This is not possible if the table is not empty.
  - Added the required column `frequency` to the `ProgramBudaya` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `ProgramBudaya` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProgramBudaya" DROP COLUMN "description",
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "frequency" INTEGER NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL;
