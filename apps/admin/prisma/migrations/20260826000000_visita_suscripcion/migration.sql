-- De qué plan es una visita, en la visita.
--
-- Antes la cobertura se decidía producto por producto (`cubrirConPlan`), y eso
-- pedía una decisión por cada línea cuando en realidad la decisión es una sola
-- y es de la visita: "esta visita es del plan mensual" o "esta es un trabajo
-- aparte". Con el plan puesto, qué productos cubre se **deduce** de lo que el
-- plan contiene; deja de ser algo que alguien elige.
--
-- Las existentes heredan el plan que ya cubría alguno de sus productos. Si
-- cubrían dos planes distintos —que no debería pasar, un producto no está en
-- dos suscripciones activas del mismo cliente— quedan en null para revisarlas.
ALTER TABLE "Visita" ADD COLUMN "suscripcionId" TEXT;

UPDATE "Visita" v
SET "suscripcionId" = sub.suscripcion_id
FROM (
  SELECT vp."visitaId", MIN(si."suscripcionId") AS suscripcion_id,
         COUNT(DISTINCT si."suscripcionId") AS cuantos
  FROM "VisitaProducto" vp
  JOIN "SuscripcionItem" si ON si."id" = vp."suscripcionItemId"
  GROUP BY vp."visitaId"
) sub
WHERE v."id" = sub."visitaId" AND sub.cuantos = 1;

-- `SetNull`: borrar un plan no puede borrar el historial de visitas. Lo que se
-- pierde es la cobertura, y sus productos quedan como trabajo suelto.
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_suscripcionId_fkey"
  FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Visita_suscripcionId_idx" ON "Visita"("suscripcionId");
