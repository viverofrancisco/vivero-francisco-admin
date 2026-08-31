-- La factura deja de ser una copia de la orden.
--
-- Hasta ahora `emitirFactura()` mapeaba cada `OrdenLinea` a un `detalles[]` de
-- Contífico, uno a uno, y por eso la factura se podía reconstruir desde la
-- orden. Pero acá se factura de otra forma: varios trabajos de un período
-- salen impresos como una sola línea de "servicio de mantenimiento". En cuanto
-- las dos formas pueden diferir, reconstruir la factura desde la orden es una
-- mentira sobre un documento que ya se entregó — así que las líneas de la
-- factura se guardan.

-- Qué documento se emitió. `NO_AUTORIZADO` es el `DNA` de Contífico: interno,
-- sin SRI y sin IVA (su API rechaza cualquier impuesto ahí).
CREATE TYPE "TipoDocumento" AS ENUM ('FACTURA', 'NO_AUTORIZADO');

ALTER TABLE "Factura" ADD COLUMN "tipo" "TipoDocumento" NOT NULL DEFAULT 'FACTURA';
-- Lo que sale en *Información Adicional*. Antes iba hardcodeado "Orden #N".
ALTER TABLE "Factura" ADD COLUMN "descripcion" TEXT;

-- El número pasa a ser único. En una factura lo garantizaba Contífico; en un
-- DNA **no lo garantiza nadie**: acepta un número repetido y crea un segundo
-- documento. Las dos series no se pisan entre sí (`001-002-000000123` contra
-- `VF-000000001`), y no hay repetidos en los datos actuales.
CREATE UNIQUE INDEX "Factura_numero_key" ON "Factura"("numero");

CREATE TABLE "FacturaLinea" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL DEFAULT 0,
    "descripcion" TEXT NOT NULL,
    "detalle" TEXT,
    "cantidad" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "ivaTasa" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "iva" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "productoId" TEXT NOT NULL,

    CONSTRAINT "FacturaLinea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FacturaLinea_facturaId_posicion_idx" ON "FacturaLinea"("facturaId", "posicion");
CREATE INDEX "FacturaLinea_productoId_idx" ON "FacturaLinea"("productoId");

ALTER TABLE "FacturaLinea" ADD CONSTRAINT "FacturaLinea_facturaId_fkey"
    FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- `RESTRICT` como en `OrdenLinea`: un producto ya facturado no se borra, o la
-- factura se queda sin con qué reconciliarse.
ALTER TABLE "FacturaLinea" ADD CONSTRAINT "FacturaLinea_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Las facturas que ya existen se emitieron todas 1:1 desde su orden, así que
-- copiar sus líneas es fiel a lo que se imprimió. Sin esto el historial
-- quedaría con facturas sin líneas, indistinguibles de un error.
INSERT INTO "FacturaLinea" (
    "id", "facturaId", "posicion", "descripcion", "detalle",
    "cantidad", "precioUnitario", "ivaTasa", "subtotal", "iva", "total", "productoId"
)
SELECT
    gen_random_uuid()::text,
    f."id",
    l."posicion",
    l."descripcion",
    NULL,
    l."cantidad",
    l."precioUnitario",
    l."ivaTasa",
    l."subtotal",
    l."iva",
    l."total",
    l."productoId"
FROM "Factura" f
JOIN "OrdenLinea" l ON l."ordenId" = f."ordenId";

-- Y la descripción que se venía mandando a Contífico, para que las viejas no
-- queden en blanco diciendo algo distinto de lo que salió impreso.
UPDATE "Factura" f
SET "descripcion" = 'Orden #' || o."numero"
FROM "Orden" o
WHERE o."id" = f."ordenId";
