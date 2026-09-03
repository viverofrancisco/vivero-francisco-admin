-- Vender una variante: la línea dice cuál, y facturar descuenta su stock.
--
-- Nulable en las dos tablas porque **un servicio no tiene variante**. Que un
-- bien sí la lleve lo exige el servicio, que es quien sabe el `tipo`; la base
-- no puede expresar "obligatorio solo si el producto es un BIEN".
ALTER TABLE "OrdenLinea"   ADD COLUMN "varianteId" TEXT;
ALTER TABLE "FacturaLinea" ADD COLUMN "varianteId" TEXT;

CREATE INDEX "OrdenLinea_varianteId_idx"   ON "OrdenLinea"("varianteId");
CREATE INDEX "FacturaLinea_varianteId_idx" ON "FacturaLinea"("varianteId");

-- `Restrict` por lo mismo que el producto: una variante ya vendida no se
-- borra. Eso hace, de paso, que sacar un eje del producto avise en vez de
-- reventar contra una foreign key.
ALTER TABLE "OrdenLinea"
  ADD CONSTRAINT "OrdenLinea_varianteId_fkey"
    FOREIGN KEY ("varianteId") REFERENCES "Variante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FacturaLinea"
  ADD CONSTRAINT "FacturaLinea_varianteId_fkey"
    FOREIGN KEY ("varianteId") REFERENCES "Variante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contra qué factura se movió el stock. Ahora sí: hasta ahora nada escribía
-- movimientos de venta, y una columna que nadie lee ni escribe es peso muerto.
ALTER TABLE "MovimientoInventario" ADD COLUMN "facturaId" TEXT;
CREATE INDEX "MovimientoInventario_facturaId_idx" ON "MovimientoInventario"("facturaId");
ALTER TABLE "MovimientoInventario"
  ADD CONSTRAINT "MovimientoInventario_facturaId_fkey"
    FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las órdenes que ya existen quedan sin variante y así se quedan: son de
-- servicios, y las de un bien se emitieron antes de que las variantes
-- existieran. Rellenarlas con la variante única sería inventar que alguien la
-- eligió.
