-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'INVITACION_CUENTA';

-- CreateTable
CREATE TABLE "SetPasswordToken" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetPasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SetPasswordToken_tokenHash_key" ON "SetPasswordToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SetPasswordToken_clienteId_idx" ON "SetPasswordToken"("clienteId");

-- AddForeignKey
ALTER TABLE "SetPasswordToken" ADD CONSTRAINT "SetPasswordToken_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
