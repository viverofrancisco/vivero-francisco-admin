-- Fuera Contífico: el portal factura directo contra el SRI.
--
-- Lo que se va es todo lo que solo existía para hablar con ellos: el vínculo
-- de cada producto con su catálogo, la categoría contable, el id del documento
-- y de la persona, y las URLs del RIDE y del XML que servían ellos —el portal
-- arma el RIDE en el momento y guarda el XML firmado en R2, en `xmlKey`—.

-- El `DNA` (documento no autorizado) era un tipo de documento *de Contífico*:
-- interno, sin SRI y sin IVA. Sin ellos no existe esa cosa, así que sale del
-- enum. Se recrea en vez de usar un `ALTER TYPE ... DROP VALUE`, que Postgres
-- no tiene.
DELETE FROM "FacturaLinea" WHERE "facturaId" IN (
  SELECT "id" FROM "Factura" WHERE "tipo" = 'NO_AUTORIZADO'
);
DELETE FROM "Factura" WHERE "tipo" = 'NO_AUTORIZADO';

ALTER TYPE "TipoDocumento" RENAME TO "TipoDocumento_old";
CREATE TYPE "TipoDocumento" AS ENUM ('FACTURA', 'NOTA_CREDITO');
ALTER TABLE "Factura" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Factura"
  ALTER COLUMN "tipo" TYPE "TipoDocumento"
  USING ("tipo"::text::"TipoDocumento");
ALTER TABLE "Factura" ALTER COLUMN "tipo" SET DEFAULT 'FACTURA';
DROP TYPE "TipoDocumento_old";

-- `origen` decía de qué lado nació el producto para saber hacia dónde
-- sincronizar. Ya no hay otro lado.
ALTER TABLE "Producto" DROP COLUMN "origen";
DROP TYPE "OrigenProducto";

DROP INDEX IF EXISTS "Producto_contificoProductoId_key";
ALTER TABLE "Producto"
  DROP COLUMN "contificoProductoId",
  DROP COLUMN "contificoCategoriaId";

ALTER TABLE "Categoria"
  DROP COLUMN "contificoCategoriaId",
  DROP COLUMN "contificoCategoriaNombre";

DROP INDEX IF EXISTS "Factura_contificoDocumentoId_key";
ALTER TABLE "Factura"
  DROP COLUMN "contificoDocumentoId",
  DROP COLUMN "contificoPersonaId",
  DROP COLUMN "urlRide",
  DROP COLUMN "urlXml",
  -- Salía impreso bajo "Información Adicional", pero el XML que firmamos no
  -- lo lleva: el RIDE mostraba un texto que el comprobante autorizado no
  -- tiene. Lo que se quiera imprimir va en la descripción de una línea, que
  -- sí viaja.
  DROP COLUMN "descripcion";

-- El nombre impreso lo ponía el producto de Contífico y `detalle` era lo único
-- que se podía agregar al lado. Ahora la descripción de la línea es texto
-- libre nuestro y va tal cual al XML, así que el campo no agrega nada.
ALTER TABLE "FacturaLinea" DROP COLUMN "detalle";
