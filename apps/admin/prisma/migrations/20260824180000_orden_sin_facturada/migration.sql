-- FACTURADA desaparece: confirmar y facturar pasaron a ser el mismo momento.
--
-- Antes había que confirmar y después emitir, y la orden vivía en CONFIRMADA
-- entre las dos cosas. Ahora "Registrar cobro" confirma, emite y cobra de una,
-- así que tener los dos estados era describir un paso que ya no existe:
-- CONFIRMADA queda como "tiene factura viva" y FACTURADA sobra.
--
-- Que esté cobrada o no **no** es un estado de la orden: se lee del saldo de su
-- factura. Son dos ejes, y cruzarlos pedía un estado por combinación.
--
-- Dos pases, y el orden importa. Primero las CONFIRMADA de hoy, que son
-- aprobadas **sin** factura viva —o sea, emisiones que fallaron—: vuelven a
-- BORRADOR, que es donde se arregla la causa. Recién después las FACTURADA
-- pasan a CONFIRMADA; al revés, el segundo pase se comería al primero.
UPDATE "Orden" o
SET "estado" = 'BORRADOR'
WHERE o."estado" = 'CONFIRMADA'
  AND NOT EXISTS (
    SELECT 1 FROM "Factura" f
    WHERE f."ordenId" = o."id" AND f."anulada" = false
  );

UPDATE "Orden" SET "estado" = 'CONFIRMADA' WHERE "estado" = 'FACTURADA';

-- Postgres no deja quitar un valor de un enum: hay que crear el tipo nuevo,
-- migrar la columna y descartar el viejo.
CREATE TYPE "EstadoOrden_new" AS ENUM ('BORRADOR', 'CONFIRMADA', 'ANULADA');

ALTER TABLE "Orden" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Orden"
  ALTER COLUMN "estado" TYPE "EstadoOrden_new"
  USING ("estado"::text::"EstadoOrden_new");
ALTER TABLE "Orden" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';

DROP TYPE "EstadoOrden";
ALTER TYPE "EstadoOrden_new" RENAME TO "EstadoOrden";
