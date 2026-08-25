-- ─────────────────────────────────────────────────────────────
-- Servicio → Producto. RENAME preserva los datos; un DROP+CREATE
-- (lo que genera `migrate diff` por su cuenta) los perdería.
-- ─────────────────────────────────────────────────────────────

-- 1) Enums nuevos
CREATE TYPE "TipoProducto" AS ENUM ('SERVICIO', 'BIEN');
CREATE TYPE "ModalidadVenta" AS ENUM ('UNICO', 'SUSCRIPCION');
CREATE TYPE "OrigenProducto" AS ENUM ('PORTAL', 'CONTIFICO');

-- 2) Renombrar la tabla y la FK que la referencia
ALTER TABLE "Servicio" RENAME TO "Producto";
ALTER TABLE "ClienteServicio" RENAME COLUMN "servicioId" TO "productoId";

-- 3) `tipo` viejo (RECURRENTE/UNICO) era en realidad la modalidad de venta.
ALTER TABLE "Producto" ADD COLUMN "modalidad" "ModalidadVenta";
UPDATE "Producto"
SET "modalidad" = CASE
  WHEN "tipo"::text = 'RECURRENTE' THEN 'SUSCRIPCION'::"ModalidadVenta"
  ELSE 'UNICO'::"ModalidadVenta"
END;
ALTER TABLE "Producto" ALTER COLUMN "modalidad" SET NOT NULL;
ALTER TABLE "Producto" ALTER COLUMN "modalidad" SET DEFAULT 'UNICO';

ALTER TABLE "Producto" DROP COLUMN "tipo";
DROP TYPE "TipoServicio";

-- Todo lo que existe hoy es un servicio de jardinería.
ALTER TABLE "Producto" ADD COLUMN "tipo" "TipoProducto" NOT NULL DEFAULT 'SERVICIO';
ALTER TABLE "Producto" ADD COLUMN "origen" "OrigenProducto" NOT NULL DEFAULT 'PORTAL';
ALTER TABLE "Producto" ADD COLUMN "codigo" TEXT;
ALTER TABLE "Producto" ADD COLUMN "contificoCategoriaId" TEXT;

-- 4) Renombrar índices y constraints para que coincidan con lo que espera Prisma
ALTER INDEX "Servicio_pkey" RENAME TO "Producto_pkey";
ALTER INDEX "ClienteServicio_clienteId_servicioId_key"
  RENAME TO "ClienteServicio_clienteId_productoId_key";
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

ALTER TABLE "Producto" RENAME CONSTRAINT "Servicio_createdById_fkey" TO "Producto_createdById_fkey";
ALTER TABLE "Producto" RENAME CONSTRAINT "Servicio_updatedById_fkey" TO "Producto_updatedById_fkey";
ALTER TABLE "ClienteServicio" RENAME CONSTRAINT "ClienteServicio_servicioId_fkey"
  TO "ClienteServicio_productoId_fkey";
