-- CreateTable
CREATE TABLE "Firmante" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firmante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Firmante_isDefault_idx" ON "Firmante"("isDefault");
