-- La categoría gana ficha propia: descripción con formato y una foto.
--
-- La foto sale de la **biblioteca**, no de una subida suya: la misma imagen
-- puede ser la de la categoría y la de su producto estrella sin subirla dos
-- veces. `SetNull` porque borrarla de la biblioteca no tiene por qué llevarse
-- la categoría.
ALTER TABLE "Categoria"
  ADD COLUMN "descripcion" TEXT,
  ADD COLUMN "mediaId" TEXT;

CREATE INDEX "Categoria_mediaId_idx" ON "Categoria"("mediaId");
ALTER TABLE "Categoria"
  ADD CONSTRAINT "Categoria_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
