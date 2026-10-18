-- Fusionar clientes duplicados: el absorbido queda archivado y dice en cuál
-- se fusionó, para que un enlace viejo lleve a la ficha que quedó.
ALTER TABLE "Cliente" ADD COLUMN "fusionadoEnId" TEXT;
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_fusionadoEnId_fkey" FOREIGN KEY ("fusionadoEnId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
