-- Si a la variante se le cobra IVA.
--
-- El *cuánto* sigue siendo del producto (`Producto.ivaTasa`): la tasa es del
-- bien, no de su color. Esto es el interruptor — apagado, la línea se propone
-- al 0% aunque el producto tenga tasa.
--
-- Arranca en `true` para todas: es lo que hoy hace el portal, que copia la tasa
-- del producto sin preguntar. Un producto exento tiene `ivaTasa` 0 o nulo, así
-- que sigue proponiendo 0 igual.
ALTER TABLE "Variante" ADD COLUMN "cobraIva" BOOLEAN NOT NULL DEFAULT true;
