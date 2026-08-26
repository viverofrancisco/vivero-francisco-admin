-- Correlativo corto del informe, como el de visitas, órdenes y suscripciones.
--
-- SERIAL y no un `ADD COLUMN ... DEFAULT`, para que los que ya existen queden
-- numerados por orden de generación —el #1 es el más viejo— y la secuencia
-- arranque después del último.
ALTER TABLE "Informe" ADD COLUMN "numero" SERIAL;

WITH ordenados AS (
  SELECT "id", row_number() OVER (ORDER BY "generatedAt", "id") AS n
  FROM "Informe"
)
UPDATE "Informe" i SET "numero" = o.n FROM ordenados o WHERE i."id" = o."id";

SELECT setval(
  pg_get_serial_sequence('"Informe"', 'numero'),
  COALESCE((SELECT MAX("numero") FROM "Informe"), 0) + 1,
  false
);

CREATE UNIQUE INDEX "Informe_numero_key" ON "Informe"("numero");
