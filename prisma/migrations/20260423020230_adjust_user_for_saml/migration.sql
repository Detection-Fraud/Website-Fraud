/*
  Warnings:

  - A unique constraint covering the columns `[samlNameId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "samlNameId" TEXT,
ALTER COLUMN "username" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_samlNameId_key" ON "User"("samlNameId");
