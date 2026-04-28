/*
  Warnings:

  - Added the required column `originalName` to the `ActivityPhoto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ActivityPhoto" ADD COLUMN     "originalName" TEXT NOT NULL;
