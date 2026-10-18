-- Una solicitud puede marcar varios servicios (opcional). Antes llevaba uno
-- solo, `productoId`, puesto desde *Solicitar cotización* en la ficha de un
-- servicio del catálogo; los servicios salen del catálogo de la app y se
-- piden acá.

-- CreateTable
CREATE TABLE "SolicitudServicio" (
    "solicitudId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,

    CONSTRAINT "SolicitudServicio_pkey" PRIMARY KEY ("solicitudId","productoId")
);

-- CreateIndex
CREATE INDEX "SolicitudServicio_productoId_idx" ON "SolicitudServicio"("productoId");

-- AddForeignKey
ALTER TABLE "SolicitudServicio" ADD CONSTRAINT "SolicitudServicio_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudServicio" ADD CONSTRAINT "SolicitudServicio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lo que ya había: el producto de cada cotización pasa a ser su servicio.
INSERT INTO "SolicitudServicio" ("solicitudId", "productoId")
SELECT "id", "productoId" FROM "SolicitudCliente" WHERE "productoId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "SolicitudCliente" DROP CONSTRAINT "SolicitudCliente_productoId_fkey";

-- AlterTable
ALTER TABLE "SolicitudCliente" DROP COLUMN "productoId";
