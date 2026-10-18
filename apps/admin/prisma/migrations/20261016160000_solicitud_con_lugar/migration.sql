-- Dónde es el trabajo de una solicitud: una de las propiedades del cliente, u
-- otra dirección con su pin. La dirección en texto sigue en "direccion".
-- AlterTable
ALTER TABLE "SolicitudCliente" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "propiedadId" TEXT;

-- AddForeignKey
ALTER TABLE "SolicitudCliente" ADD CONSTRAINT "SolicitudCliente_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "Propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SolicitudCliente_propiedadId_idx" ON "SolicitudCliente"("propiedadId");
