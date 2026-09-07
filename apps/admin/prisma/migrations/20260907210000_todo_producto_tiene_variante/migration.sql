-- Todo producto tiene exactamente una variante, servicios incluidos.
--
-- Antes solo la tenían los bienes, con el argumento de que un servicio no lleva
-- stock. Pero la variante no es solo "dónde se cuenta": es **lo que se vende**.
-- Sin ella, una línea de orden apuntaba a un producto o a una variante según el
-- tipo —dos formas para la misma cosa— y cada lugar que preguntaba el SKU, el
-- precio o el stock tenía que ramificar. Lo que un servicio no tiene es
-- inventario, y eso ya se dice con `manejaInventario`.
--
-- Un servicio sigue sin poder tener opciones: las opciones multiplican
-- variantes, y de eso solo tiene sentido hablar en un bien.

-- 1. La variante que falta, una por producto que no tenga ninguna.
--
-- `manejaInventario` en false: no hay stock de una poda. El SKU sale del código
-- que el producto ya tenía, así que el código impreso en la factura no cambia.
INSERT INTO "Variante" ("id", "productoId", "sku", "combinacion", "manejaInventario", "permiteNegativo", "posicion", "precio", "cobraIva")
SELECT gen_random_uuid()::text, p."id", p."codigo", '', false, false, 0, 0, true
FROM "Producto" p
WHERE NOT EXISTS (SELECT 1 FROM "Variante" v WHERE v."productoId" = p."id");

-- 2. Las líneas que ya existen apuntan a la variante de su producto.
--
-- Se elige la primera por posición. Con una sola variante —todos los servicios
-- y los bienes sin opciones— no hay ambigüedad; en un bien con varias es una
-- suposición sobre historia que ya se emitió, y el código que salió impreso no
-- cambia: vive en el XML firmado, que se guarda entero.
UPDATE "OrdenLinea" l
SET "varianteId" = (
  SELECT v."id" FROM "Variante" v
  WHERE v."productoId" = l."productoId"
  ORDER BY v."posicion" ASC, v."id" ASC
  LIMIT 1
)
WHERE l."varianteId" IS NULL;

UPDATE "FacturaLinea" l
SET "varianteId" = (
  SELECT v."id" FROM "Variante" v
  WHERE v."productoId" = l."productoId"
  ORDER BY v."posicion" ASC, v."id" ASC
  LIMIT 1
)
WHERE l."varianteId" IS NULL;

ALTER TABLE "OrdenLinea"   ALTER COLUMN "varianteId" SET NOT NULL;
ALTER TABLE "FacturaLinea" ALTER COLUMN "varianteId" SET NOT NULL;

-- 3. El código deja de vivir en el producto: ya está en el SKU de su variante.
--
-- Tenerlo en los dos lados dejaba dos campos donde escribir un código y solo
-- uno ganaba al facturar, que es una forma segura de que alguien complete el
-- que no se usa.
DROP INDEX IF EXISTS "Producto_codigo_key";
ALTER TABLE "Producto" DROP COLUMN "codigo";
