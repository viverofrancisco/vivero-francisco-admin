-- Notas de crédito: la forma de corregir una factura que el SRI ya autorizó.
--
-- Viven en la misma tabla que las facturas porque **son otro comprobante**: se
-- firman, se mandan, se consultan y se guardan igual. Separarlas en su propia
-- tabla habría duplicado el barrido de autorización, el RIDE, el envío por
-- correo y el guardado del XML.
--
-- Anular en el SRI es otra cosa y no la reemplaza: es un trámite manual del
-- portal de ellos, con plazo hasta el día 7 del mes siguiente, que además
-- necesita que el cliente acepte y que desde 2026 está prohibido para
-- consumidor final. La nota de crédito la puede emitir el portal solo y
-- funciona siempre.

ALTER TYPE "TipoDocumento" ADD VALUE 'NOTA_CREDITO';

-- Qué factura corrige, y por qué. El SRI exige las dos cosas en el XML.
ALTER TABLE "Factura" ADD COLUMN "facturaModificadaId" TEXT;
ALTER TABLE "Factura" ADD COLUMN "motivo" TEXT;
CREATE INDEX "Factura_facturaModificadaId_idx" ON "Factura"("facturaModificadaId");

-- `RESTRICT`: una factura con nota de crédito no se borra sin resolver la nota.
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_facturaModificadaId_fkey"
    FOREIGN KEY ("facturaModificadaId") REFERENCES "Factura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El número deja de ser único a secas y pasa a serlo **por tipo**: una factura
-- y una nota de crédito llevan cada una su propia serie, así que
-- `001-001-000000001` existe una vez de cada. Sin esto, la primera nota de
-- crédito chocaría contra la primera factura.
DROP INDEX "Factura_numero_key";
CREATE UNIQUE INDEX "Factura_tipo_numero_key" ON "Factura"("tipo", "numero");
