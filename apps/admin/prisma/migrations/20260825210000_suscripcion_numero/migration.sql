-- Un número corto para nombrar una suscripción, como el de las órdenes.
--
-- Secuencia propia: que coexistan la orden #12 y la suscripción #12 no molesta,
-- porque en pantalla siempre llevan su prefijo. Una secuencia compartida las
-- dejaría con huecos (#3, #17, #40) sin ganar nada.
--
-- Las que ya existen se numeran por antigüedad, que es el orden en que las
-- habría dado la secuencia si hubiera existido desde el principio.
ALTER TABLE "Suscripcion" ADD COLUMN "numero" SERIAL;

WITH ordenadas AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n
  FROM "Suscripcion"
)
UPDATE "Suscripcion" s SET "numero" = o.n FROM ordenadas o WHERE s."id" = o."id";

-- La secuencia tiene que arrancar después de lo ya asignado.
SELECT setval(
  pg_get_serial_sequence('"Suscripcion"', 'numero'),
  COALESCE((SELECT MAX("numero") FROM "Suscripcion"), 0) + 1,
  false
);

CREATE UNIQUE INDEX "Suscripcion_numero_key" ON "Suscripcion"("numero");
