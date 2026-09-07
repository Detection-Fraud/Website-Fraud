-- CreateTable
CREATE TABLE "PicImportantInformation" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PicImportantInformation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PicImportantInformationOrderState" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PicImportantInformationOrderState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PicImportantInformation_order_createdAt_id_idx" ON "PicImportantInformation"("order", "createdAt", "id");

-- CreateIndex
CREATE INDEX "PicImportantInformation_isActive_order_createdAt_id_idx" ON "PicImportantInformation"("isActive", "order", "createdAt", "id");

-- Seed singleton revision state idempotently
INSERT INTO "PicImportantInformationOrderState" ("id", "revision", "updatedAt")
VALUES ('global', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
