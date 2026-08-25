-- Con qué datos se va a facturar una orden.
--
-- Se elige al armarla, cuando quien vende tiene al cliente delante y puede
-- preguntarle a nombre de quién quiere la factura. Al emitir ya es tarde: la
-- orden está confirmada y alguien está esperando el papel.
--
-- Nullable: una orden puede existir antes de saberlo (por ejemplo las que
-- genera el cron de renovaciones). Al emitir, si viene vacío se usa el
-- predeterminado del cliente.
ALTER TABLE "Orden" ADD COLUMN "datoFacturacionId" TEXT;

ALTER TABLE "Orden"
  ADD CONSTRAINT "Orden_datoFacturacionId_fkey"
  FOREIGN KEY ("datoFacturacionId") REFERENCES "DatoFacturacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Orden_datoFacturacionId_idx" ON "Orden"("datoFacturacionId");
