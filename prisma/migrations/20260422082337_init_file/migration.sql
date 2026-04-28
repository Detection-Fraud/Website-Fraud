-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'KANWIL', 'KANCAB', 'DIVISI');

-- CreateTable
CREATE TABLE "Kanwil" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "kode" TEXT NOT NULL,

    CONSTRAINT "Kanwil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kanwil_kode_key" ON "Kanwil"("kode");
