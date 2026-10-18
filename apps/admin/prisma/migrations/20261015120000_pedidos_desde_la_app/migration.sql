-- Pedidos desde el carrito de la app: de dónde salió la orden, cómo se entrega, y
-- el stock que aparta (RESERVA/LIBERACION en el libro, con el ordenId).
-- CreateEnum
CREATE TYPE "OrigenOrden" AS ENUM ('PORTAL', 'APP');

-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('RETIRO', 'ENTREGA');

-- CreateEnum
CREATE TYPE "LugarDeRetiro" AS ENUM ('HIPODROMO', 'AURORA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MotivoMovimiento" ADD VALUE 'RESERVA';
ALTER TYPE "MotivoMovimiento" ADD VALUE 'LIBERACION';

-- AlterTable
ALTER TABLE "MovimientoInventario" ADD COLUMN     "ordenId" TEXT;

-- AlterTable
ALTER TABLE "Orden" ADD COLUMN     "entrega" "TipoEntrega",
ADD COLUMN     "entregaDireccion" TEXT,
ADD COLUMN     "entregaLat" DOUBLE PRECISION,
ADD COLUMN     "entregaLng" DOUBLE PRECISION,
ADD COLUMN     "entregaPropiedadId" TEXT,
ADD COLUMN     "origen" "OrigenOrden" NOT NULL DEFAULT 'PORTAL',
ADD COLUMN     "retiroEn" "LugarDeRetiro",
ADD COLUMN     "stockReservado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MovimientoInventario_ordenId_idx" ON "MovimientoInventario"("ordenId");

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_entregaPropiedadId_fkey" FOREIGN KEY ("entregaPropiedadId") REFERENCES "Propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

