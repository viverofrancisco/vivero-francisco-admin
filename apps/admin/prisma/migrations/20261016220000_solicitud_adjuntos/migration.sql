-- CreateTable
CREATE TABLE "SolicitudAdjunto" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "nombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudAdjunto_solicitudId_idx" ON "SolicitudAdjunto"("solicitudId");

-- AddForeignKey
ALTER TABLE "SolicitudAdjunto" ADD CONSTRAINT "SolicitudAdjunto_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

