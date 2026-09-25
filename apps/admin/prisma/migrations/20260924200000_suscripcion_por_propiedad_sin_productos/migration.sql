-- Un plan es un precio por un jardín.
--
-- La suscripción era una lista de productos del catálogo, cada uno con su
-- precio, su IVA y sus visitas por período (`SuscripcionItem`), y la orden de
-- cada período salía con una línea por ítem. Armar un plan era elegir tres
-- productos y ponerles precio a cada uno para llegar a la mensualidad que ya
-- se había pactado. Lo que se acuerda con el cliente es un número por
-- mantenerle **ese** jardín, así que eso es lo que se guarda: el precio, el
-- IVA y las visitas van en la cabecera, y el plan dice de qué propiedad es.
--
-- Orden: crear lo nuevo → backfillear desde los ítems → recién ahí borrarlos.

-- ── 1. Suscripción: las columnas nuevas, opcionales para poder rellenarlas ──
ALTER TABLE "Suscripcion"
    ADD COLUMN "propiedadId" TEXT,
    ADD COLUMN "precio" DECIMAL(10,2),
    ADD COLUMN "ivaTasa" DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN "visitasPorPeriodo" INTEGER;

-- Precio e IVA desde los ítems.
--
-- Con una sola tasa entre los ítems no hay nada que decidir: el precio es la
-- suma de las bases y la tasa es esa. Con tasas mezcladas (un abono al 0% y
-- una poda al 15%) una sola tasa no puede reproducir la cuenta, y lo que se
-- conserva es **lo que el cliente paga**: se toma la tasa del ítem más caro y
-- la base sale de dividir el total con IVA por ella. La base queda con
-- centavos raros, el total no cambia. Quien revise el plan puede redondear.
--
-- Las visitas por período son el máximo entre los ítems, no la suma: "4 de
-- mantenimiento y 2 de abono" son cuatro viajes en los que dos llevan abono,
-- no seis. Sin ítems (no debería pasar) queda precio 0 y una visita.
WITH resumen AS (
    SELECT
        i."suscripcionId",
        SUM(i."precio") AS base,
        SUM(i."precio" * (1 + i."ivaTasa" / 100)) AS con_iva,
        COUNT(DISTINCT i."ivaTasa") AS tasas,
        MAX(i."visitasPorPeriodo") AS visitas,
        (ARRAY_AGG(i."ivaTasa" ORDER BY i."precio" DESC, i."ivaTasa" DESC))[1] AS tasa_principal
    FROM "SuscripcionItem" i
    GROUP BY i."suscripcionId"
)
UPDATE "Suscripcion" s SET
    "ivaTasa" = r.tasa_principal,
    "precio" = CASE
        WHEN r.tasas = 1 THEN r.base
        ELSE ROUND(r.con_iva / (1 + r.tasa_principal / 100), 2)
    END,
    "visitasPorPeriodo" = COALESCE(r.visitas, 1)
FROM resumen r
WHERE r."suscripcionId" = s."id";

UPDATE "Suscripcion" SET "precio" = 0 WHERE "precio" IS NULL;
UPDATE "Suscripcion" SET "visitasPorPeriodo" = 1 WHERE "visitasPorPeriodo" IS NULL;

-- De qué propiedad es cada plan. Primero la de sus visitas, si todas pasan en
-- la misma; si no, la propiedad viva más antigua del cliente —la "Principal"
-- que creó la migración de propiedades—; si el cliente no tiene ninguna viva,
-- cualquiera; y si no tiene ninguna, se le crea la "Principal" con el mismo
-- id determinista que usó esa migración.
UPDATE "Suscripcion" s SET "propiedadId" = v.pid
FROM (
    SELECT "suscripcionId", MIN("propiedadId") AS pid
    FROM "Visita"
    WHERE "suscripcionId" IS NOT NULL AND "deletedAt" IS NULL
    GROUP BY "suscripcionId"
    HAVING COUNT(DISTINCT "propiedadId") = 1
) v
WHERE v."suscripcionId" = s."id";

UPDATE "Suscripcion" s SET "propiedadId" = (
    SELECT p."id" FROM "Propiedad" p
    WHERE p."clienteId" = s."clienteId"
    ORDER BY (p."deletedAt" IS NOT NULL), p."createdAt"
    LIMIT 1
)
WHERE s."propiedadId" IS NULL;

INSERT INTO "Propiedad" ("id", "clienteId", "nombre", "createdAt", "updatedAt")
SELECT DISTINCT 'prop_' || s."clienteId", s."clienteId", 'Principal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Suscripcion" s
WHERE s."propiedadId" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "Suscripcion" s SET "propiedadId" = 'prop_' || s."clienteId"
WHERE s."propiedadId" IS NULL;

ALTER TABLE "Suscripcion"
    ALTER COLUMN "propiedadId" SET NOT NULL,
    ALTER COLUMN "precio" SET NOT NULL,
    ALTER COLUMN "visitasPorPeriodo" SET NOT NULL;

CREATE INDEX "Suscripcion_propiedadId_idx" ON "Suscripcion"("propiedadId");
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_propiedadId_fkey"
    FOREIGN KEY ("propiedadId") REFERENCES "Propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 2. La orden dice de qué plan es ──
--
-- Las renovaciones automáticas creaban la orden sin `suscripcionId` en la
-- cabecera: el plan solo se sabía dando la vuelta por las líneas. Se completa
-- antes de tocarlas. Todas las líneas de una orden son del mismo plan
-- (`ensureNoMezclaOrigenes`), así que cualquiera sirve.
UPDATE "Orden" o SET "suscripcionId" = i."suscripcionId"
FROM "OrdenLinea" l
JOIN "SuscripcionItem" i ON i."id" = l."suscripcionItemId"
WHERE l."ordenId" = o."id" AND o."suscripcionId" IS NULL;

-- ── 3. La línea apunta al plan, no al ítem ──
ALTER TABLE "OrdenLinea" ADD COLUMN "suscripcionId" TEXT;

-- El índice único pasa a ser `[suscripcionId, periodoInicio]`: **una** línea
-- por período de plan. Las órdenes viejas tenían una por ítem, y a veces en
-- órdenes distintas (un ítem agregado después se ponía al día por su cuenta).
-- Se queda con el vínculo la primera —la orden más antigua, y dentro de ella
-- la primera posición—; las demás conservan su producto y sus fechas, que son
-- lo que se vendió y cuándo, pero sueltan el vínculo. Nada se recalcula: son
-- documentos que ya se emitieron.
UPDATE "OrdenLinea" l SET "suscripcionId" = i."suscripcionId"
FROM "SuscripcionItem" i
WHERE l."suscripcionItemId" = i."id"
  AND l."id" = (
      SELECT l2."id"
      FROM "OrdenLinea" l2
      JOIN "SuscripcionItem" i2 ON i2."id" = l2."suscripcionItemId"
      JOIN "Orden" o2 ON o2."id" = l2."ordenId"
      WHERE i2."suscripcionId" = i."suscripcionId"
        AND l2."periodoInicio" IS NOT DISTINCT FROM l."periodoInicio"
      ORDER BY o2."createdAt", l2."posicion", l2."id"
      LIMIT 1
  );

ALTER TABLE "OrdenLinea" DROP CONSTRAINT "OrdenLinea_suscripcionItemId_fkey";
DROP INDEX "OrdenLinea_suscripcionItemId_periodoInicio_key";
ALTER TABLE "OrdenLinea" DROP COLUMN "suscripcionItemId";

CREATE UNIQUE INDEX "OrdenLinea_suscripcionId_periodoInicio_key" ON "OrdenLinea"("suscripcionId", "periodoInicio");
CREATE INDEX "OrdenLinea_suscripcionId_idx" ON "OrdenLinea"("suscripcionId");
ALTER TABLE "OrdenLinea" ADD CONSTRAINT "OrdenLinea_suscripcionId_fkey"
    FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. Producto y variante opcionales en la línea: la de un plan no tiene ──
--
-- Toda línea sigue exigiendo producto **o** período de plan; eso lo cuida
-- `validarLineas`. Un CHECK no puede decirlo sin rechazar las líneas viejas,
-- que traen las dos cosas.
ALTER TABLE "OrdenLinea"
    ALTER COLUMN "productoId" DROP NOT NULL,
    ALTER COLUMN "varianteId" DROP NOT NULL;
ALTER TABLE "FacturaLinea"
    ALTER COLUMN "productoId" DROP NOT NULL,
    ALTER COLUMN "varianteId" DROP NOT NULL;

-- ── 5. El código impreso se congela en la línea de la factura ──
--
-- Se derivaba al vuelo (el SKU de la variante, o el id del producto), así que
-- una nota de crédito imprimía el SKU de hoy y no el del comprobante que
-- corrige; y la línea de un plan no tiene de dónde derivarlo. Lo existente se
-- rellena con la misma regla que se venía aplicando.
ALTER TABLE "FacturaLinea" ADD COLUMN "codigo" TEXT;

UPDATE "FacturaLinea" fl SET "codigo" = COALESCE(v."sku", UPPER(RIGHT(fl."productoId", 10)))
FROM "Variante" v
WHERE v."id" = fl."varianteId";

UPDATE "FacturaLinea" SET "codigo" = UPPER(RIGHT("productoId", 10))
WHERE "codigo" IS NULL AND "productoId" IS NOT NULL;

DO $$
DECLARE sin_codigo INT;
BEGIN
    SELECT COUNT(*) INTO sin_codigo FROM "FacturaLinea" WHERE "codigo" IS NULL;
    IF sin_codigo > 0 THEN
        RAISE EXCEPTION 'Hay % línea(s) de factura sin producto ni variante: no se les puede derivar el código impreso. Revisar: SELECT * FROM "FacturaLinea" WHERE "codigo" IS NULL', sin_codigo;
    END IF;
END $$;

ALTER TABLE "FacturaLinea" ALTER COLUMN "codigo" SET NOT NULL;

-- ── 6. Chau ítems ──
DROP TABLE "SuscripcionItem";
