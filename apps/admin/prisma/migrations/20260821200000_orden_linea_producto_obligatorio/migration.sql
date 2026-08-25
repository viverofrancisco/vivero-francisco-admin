-- Toda línea de orden tiene que apuntar a un producto del catálogo.
--
-- Contífico exige `producto_id` en cada `detalles[]` y no acepta texto libre:
-- una línea sin producto es una venta que no se puede cobrar. Hasta ahora la
-- regla la sostenían solo los servicios; acá pasa a estar en la base.
--
-- La FK pasa de SET NULL a RESTRICT: un producto que ya se vendió no se puede
-- borrar. Perder ese vínculo dejaría la línea fuera de todo reporte por
-- producto y la factura sin con qué reconciliarse. (El portal borra en suave,
-- así que en el uso normal no cambia nada.)

-- Falla temprano y con un mensaje que dice qué hacer. Sin esto, la deploy
-- moriría con un "null value violates not-null constraint" a secas.
DO $$
DECLARE huerfanas INT;
BEGIN
  SELECT COUNT(*) INTO huerfanas FROM "OrdenLinea" WHERE "productoId" IS NULL;
  IF huerfanas > 0 THEN
    RAISE EXCEPTION
      'Hay % línea(s) de orden sin producto. Asignales uno o borralas antes de aplicar esta migración: SELECT * FROM "OrdenLinea" WHERE "productoId" IS NULL;',
      huerfanas;
  END IF;
END $$;

ALTER TABLE "OrdenLinea" DROP CONSTRAINT "OrdenLinea_productoId_fkey";

ALTER TABLE "OrdenLinea" ALTER COLUMN "productoId" SET NOT NULL;

ALTER TABLE "OrdenLinea"
  ADD CONSTRAINT "OrdenLinea_productoId_fkey"
  FOREIGN KEY ("productoId") REFERENCES "Producto"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
