/*
  Warnings:

  - You are about to drop the column `originalName` on the `ActivityPhoto` table. All the data in the column will be lost.
  - Added the required column `imageUrl` to the `ActivityPhoto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ActivityPhoto" DROP COLUMN "originalName",
ADD COLUMN     "imageUrl" TEXT NOT NULL;
