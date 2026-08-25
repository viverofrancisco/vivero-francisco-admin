-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('BORRADOR', 'CONFIRMADA', 'FACTURADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('PENDIENTE', 'FIRMADO', 'ENVIADO_SRI', 'AUTORIZADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "ClienteServicio" ADD COLUMN     "ivaTasa" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "Orden" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'BORRADOR',
    "notas" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenLinea" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL DEFAULT 0,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "ivaTasa" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "iva" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "productoId" TEXT,
    "clienteServicioId" TEXT,
    "periodoInicio" DATE,
    "periodoFin" DATE,
    "visitaServicioId" TEXT,

    CONSTRAINT "OrdenLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factura" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "contificoDocumentoId" TEXT,
    "numero" TEXT NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'PENDIENTE',
    "autorizacion" TEXT,
    "urlRide" TEXT,
    "urlXml" TEXT,
    "contificoPersonaId" TEXT,
    "subtotal0" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotalGravado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Orden_numero_key" ON "Orden"("numero");

-- CreateIndex
CREATE INDEX "Orden_clienteId_fecha_idx" ON "Orden"("clienteId", "fecha");

-- CreateIndex
CREATE INDEX "Orden_estado_idx" ON "Orden"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenLinea_visitaServicioId_key" ON "OrdenLinea"("visitaServicioId");

-- CreateIndex
CREATE INDEX "OrdenLinea_ordenId_posicion_idx" ON "OrdenLinea"("ordenId", "posicion");

-- CreateIndex
CREATE INDEX "OrdenLinea_productoId_idx" ON "OrdenLinea"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenLinea_clienteServicioId_periodoInicio_key" ON "OrdenLinea"("clienteServicioId", "periodoInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Factura_contificoDocumentoId_key" ON "Factura"("contificoDocumentoId");

-- CreateIndex
CREATE INDEX "Factura_ordenId_idx" ON "Factura"("ordenId");

-- CreateIndex
CREATE INDEX "Factura_estado_idx" ON "Factura"("estado");

-- AddForeignKey
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenLinea" ADD CONSTRAINT "OrdenLinea_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenLinea" ADD CONSTRAINT "OrdenLinea_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenLinea" ADD CONSTRAINT "OrdenLinea_clienteServicioId_fkey" FOREIGN KEY ("clienteServicioId") REFERENCES "ClienteServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenLinea" ADD CONSTRAINT "OrdenLinea_visitaServicioId_fkey" FOREIGN KEY ("visitaServicioId") REFERENCES "VisitaServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Backfill de ivaTasa desde el monto de IVA que ya estaba cargado.
-- El IVA en Ecuador pasó de 12% a 15% en 2024: guardar la tasa evita tener
-- que migrar datos de plata más adelante.
-- ─────────────────────────────────────────────────────────────
UPDATE "ClienteServicio"
SET "ivaTasa" = CASE
  WHEN "precio" > 0 THEN ROUND(("iva" / "precio") * 100, 2)
  ELSE 0
END;
