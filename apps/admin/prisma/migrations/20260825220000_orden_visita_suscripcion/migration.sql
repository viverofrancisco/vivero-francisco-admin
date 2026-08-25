-- De qué es una orden, en la orden.
--
-- Las líneas ya decían de dónde sale cada peso, pero eso responde otra
-- pregunta. "¿De qué es esta orden?" es la que se hace primero y obligaba a
-- recorrer las líneas para contestarla.
--
-- Es coherente porque las reglas ya lo garantizaban: una orden no mezcla plan
-- con visitas y se lleva entero el trabajo de lo que toca. Que además tenga
-- productos agregados a mano no la hace menos "de esa visita".
ALTER TABLE "Orden" ADD COLUMN "visitaId" TEXT;
ALTER TABLE "Orden" ADD COLUMN "suscripcionId" TEXT;

-- Backfill desde la procedencia de las líneas. Una orden cuyas líneas se
-- liberaron (porque se anuló) queda en null: ya no hay de dónde deducirlo.
UPDATE "Orden" o
SET "visitaId" = sub.visita_id
FROM (
  SELECT ol."ordenId", MIN(vp."visitaId") AS visita_id,
         COUNT(DISTINCT vp."visitaId") AS cuantas
  FROM "OrdenLinea" ol
  JOIN "VisitaProducto" vp ON vp."id" = ol."visitaProductoId"
  GROUP BY ol."ordenId"
) sub
WHERE o."id" = sub."ordenId" AND sub.cuantas = 1;

UPDATE "Orden" o
SET "suscripcionId" = sub.suscripcion_id
FROM (
  SELECT ol."ordenId", MIN(si."suscripcionId") AS suscripcion_id,
         COUNT(DISTINCT si."suscripcionId") AS cuantas
  FROM "OrdenLinea" ol
  JOIN "SuscripcionItem" si ON si."id" = ol."suscripcionItemId"
  GROUP BY ol."ordenId"
) sub
WHERE o."id" = sub."ordenId" AND sub.cuantas = 1;

ALTER TABLE "Orden" ADD CONSTRAINT "Orden_visitaId_fkey"
  FOREIGN KEY ("visitaId") REFERENCES "Visita"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_suscripcionId_fkey"
  FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una orden es de una visita, de un plan, o de nada. Nunca de las dos cosas:
-- la regla ya existía en el servicio y acá deja de depender de que alguien la
-- respete.
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_un_solo_origen"
  CHECK ("visitaId" IS NULL OR "suscripcionId" IS NULL);

CREATE INDEX "Orden_visitaId_idx" ON "Orden"("visitaId");
CREATE INDEX "Orden_suscripcionId_idx" ON "Orden"("suscripcionId");
