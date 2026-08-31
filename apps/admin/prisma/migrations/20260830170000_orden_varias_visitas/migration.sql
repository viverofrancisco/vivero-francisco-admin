-- Una orden puede cubrir varias visitas, y una línea varios trabajos.
--
-- Dos límites que venían del esquema, no del negocio:
--
-- 1. `Orden.visitaId` era una columna, así que una orden era "de una visita".
--    Pero cobrar el mes entero de alguien en una sola orden es lo normal, y
--    `origenDeLaOrden()` lo rechazaba con "Una orden es de una sola visita".
-- 2. `OrdenLinea.visitaProductoId` era único, así que el mismo producto hecho
--    en dos visitas salía como dos líneas en la misma orden. Eso no le dice
--    nada a nadie —es el mismo producto— y duplica la decisión de precio.
--
-- Las dos pasan a ser tablas puente. Lo que **no** cambia es la garantía que
-- importa: `visitaProductoId` sigue siendo único en toda la tabla, así que un
-- trabajo se sigue facturando una sola vez, y lo garantiza la base.

-- De qué visitas es una orden.
CREATE TABLE "OrdenVisita" (
    "ordenId" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,

    CONSTRAINT "OrdenVisita_pkey" PRIMARY KEY ("ordenId", "visitaId")
);
CREATE INDEX "OrdenVisita_visitaId_idx" ON "OrdenVisita"("visitaId");

ALTER TABLE "OrdenVisita" ADD CONSTRAINT "OrdenVisita_ordenId_fkey"
    FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- `RESTRICT`, como la columna que reemplaza: una visita con orden no se borra
-- sin resolver la orden antes.
ALTER TABLE "OrdenVisita" ADD CONSTRAINT "OrdenVisita_visitaId_fkey"
    FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Qué trabajo paga cada línea.
CREATE TABLE "OrdenLineaOrigen" (
    "ordenLineaId" TEXT NOT NULL,
    "visitaProductoId" TEXT NOT NULL,

    CONSTRAINT "OrdenLineaOrigen_pkey" PRIMARY KEY ("ordenLineaId", "visitaProductoId")
);
-- **La garantía anti doble cobro**, la misma que daba la columna única.
CREATE UNIQUE INDEX "OrdenLineaOrigen_visitaProductoId_key" ON "OrdenLineaOrigen"("visitaProductoId");
CREATE INDEX "OrdenLineaOrigen_ordenLineaId_idx" ON "OrdenLineaOrigen"("ordenLineaId");

ALTER TABLE "OrdenLineaOrigen" ADD CONSTRAINT "OrdenLineaOrigen_ordenLineaId_fkey"
    FOREIGN KEY ("ordenLineaId") REFERENCES "OrdenLinea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- `RESTRICT` y no `SET NULL`: el trabajo facturado no se borra. Como
-- `VisitaProducto` cascadea desde `Visita`, esto protege también a la visita.
ALTER TABLE "OrdenLineaOrigen" ADD CONSTRAINT "OrdenLineaOrigen_visitaProductoId_fkey"
    FOREIGN KEY ("visitaProductoId") REFERENCES "VisitaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: cada columna se convierte en una fila. Uno a uno, sin pérdida.
INSERT INTO "OrdenLineaOrigen" ("ordenLineaId", "visitaProductoId")
SELECT "id", "visitaProductoId" FROM "OrdenLinea" WHERE "visitaProductoId" IS NOT NULL;

INSERT INTO "OrdenVisita" ("ordenId", "visitaId")
SELECT "id", "visitaId" FROM "Orden" WHERE "visitaId" IS NOT NULL;

-- Y fuera las columnas. El CHECK sobraba: ya no hay dos columnas que excluir.
ALTER TABLE "Orden" DROP CONSTRAINT IF EXISTS "Orden_un_solo_origen";
ALTER TABLE "Orden" DROP CONSTRAINT IF EXISTS "Orden_visitaId_fkey";
DROP INDEX IF EXISTS "Orden_visitaId_idx";
ALTER TABLE "Orden" DROP COLUMN "visitaId";

ALTER TABLE "OrdenLinea" DROP CONSTRAINT IF EXISTS "OrdenLinea_visitaProductoId_fkey";
DROP INDEX IF EXISTS "OrdenLinea_visitaProductoId_key";
ALTER TABLE "OrdenLinea" DROP COLUMN "visitaProductoId";
