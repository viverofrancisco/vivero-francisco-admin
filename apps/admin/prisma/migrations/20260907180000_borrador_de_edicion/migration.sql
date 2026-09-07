-- Editar un informe también se puede dejar a medias.
--
-- Sin esta columna, retomar ese borrador habría creado un informe nuevo en vez
-- de volver a la edición del que se quería corregir — o sea, justo el duplicado
-- que las versiones vinieron a evitar.
ALTER TABLE "InformeBorrador" ADD COLUMN "informeId" TEXT;

CREATE INDEX "InformeBorrador_informeId_idx" ON "InformeBorrador"("informeId");

ALTER TABLE "InformeBorrador"
  ADD CONSTRAINT "InformeBorrador_informeId_fkey"
  FOREIGN KEY ("informeId") REFERENCES "Informe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
