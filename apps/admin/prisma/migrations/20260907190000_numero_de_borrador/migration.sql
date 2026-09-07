-- Un borrador también se nombra en voz alta, así que también lleva número.
--
-- Sale de la **misma secuencia** que los informes: con una propia, el #17 sería
-- un borrador y un informe al mismo tiempo. El informe hereda el número del
-- borrador al generarse, así que el borrador #17 se convierte en el informe
-- #17 y nadie tiene que aprender dos numeraciones.
--
-- El default apunta a la secuencia de `Informe.numero` a propósito. En el
-- schema de Prisma la columna va sin `@default`, porque `autoincrement()`
-- crearía una secuencia propia; el servicio pide `nextval` explícitamente.
ALTER TABLE "InformeBorrador"
  ADD COLUMN "numero" INTEGER NOT NULL DEFAULT nextval('"Informe_numero_seq"');

-- Los que ya existen quedan con el número que les tocó del default de arriba.
ALTER TABLE "InformeBorrador" ALTER COLUMN "numero" DROP DEFAULT;

CREATE UNIQUE INDEX "InformeBorrador_numero_key" ON "InformeBorrador"("numero");
