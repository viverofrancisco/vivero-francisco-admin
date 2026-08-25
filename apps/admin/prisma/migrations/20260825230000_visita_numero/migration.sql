-- Un número corto para nombrar una visita, como el de órdenes y suscripciones.
--
-- Sin él, para identificar una visita había que decir su producto y su fecha, y
-- el producto no la identifica: dos visitas del mismo cliente pueden llevar el
-- mismo. Secuencia propia; en pantalla siempre va con su prefijo.
--
-- Las existentes se numeran por fecha programada, que es el orden en que
-- ocurrieron y el que habría dado la secuencia.
ALTER TABLE "Visita" ADD COLUMN "numero" SERIAL;

WITH ordenadas AS (
  SELECT "id",
         row_number() OVER (ORDER BY "fechaProgramada", "createdAt", "id") AS n
  FROM "Visita"
)
UPDATE "Visita" v SET "numero" = o.n FROM ordenadas o WHERE v."id" = o."id";

SELECT setval(
  pg_get_serial_sequence('"Visita"', 'numero'),
  COALESCE((SELECT MAX("numero") FROM "Visita"), 0) + 1,
  false
);

CREATE UNIQUE INDEX "Visita_numero_key" ON "Visita"("numero");
