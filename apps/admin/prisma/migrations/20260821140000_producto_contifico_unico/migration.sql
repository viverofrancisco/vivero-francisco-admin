-- Un producto de Contífico se vincula a un solo producto del portal.
--
-- Sin esto, dos productos del portal podrían apuntar al mismo `producto_id`:
-- la factura saldría igual, pero al leerla hacia atrás no habría forma de
-- saber cuál de los dos se vendió.
CREATE UNIQUE INDEX "Producto_contificoProductoId_key"
  ON "Producto"("contificoProductoId");
