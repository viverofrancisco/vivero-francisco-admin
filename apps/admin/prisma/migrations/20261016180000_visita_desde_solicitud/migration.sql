-- AlterTable
ALTER TABLE "Visita" ADD COLUMN     "solicitudId" TEXT;

-- CreateIndex
CREATE INDEX "Visita_solicitudId_idx" ON "Visita"("solicitudId");

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

