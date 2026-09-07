-- Biblioteca de medios: el archivo se sube una vez y se usa en varios lugares.
--
-- Antes cada `ProductoImagen` era su propio objeto en R2, así que usar la misma
-- foto en dos productos significaba subirla dos veces. Ahora `Media` es el
-- archivo y `ProductoImagen` dice cuál usa cada producto y en qué orden.

CREATE TABLE "Media" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "alt"         TEXT,
    "contentType" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Media_key_key" ON "Media"("key");
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");
ALTER TABLE "Media"
  ADD CONSTRAINT "Media_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cada imagen que ya existía pasa a ser una fila de la biblioteca. El nombre
-- sale del `key` porque es lo único que hay: se subían con un uuid, así que va
-- a leerse feo hasta que alguien las renombre — pero es la verdad, y esconderla
-- detrás de un "sin nombre" sería peor.
--
-- El tipo se deduce de la extensión: tampoco se guardaba.
INSERT INTO "Media" ("id", "key", "nombre", "alt", "contentType", "createdAt")
SELECT
  gen_random_uuid()::text,
  "key",
  regexp_replace("key", '^.*/', ''),
  "alt",
  CASE
    WHEN "key" ILIKE '%.png'  THEN 'image/png'
    WHEN "key" ILIKE '%.webp' THEN 'image/webp'
    WHEN "key" ILIKE '%.gif'  THEN 'image/gif'
    WHEN "key" ILIKE '%.avif' THEN 'image/avif'
    ELSE 'image/jpeg'
  END,
  "createdAt"
FROM "ProductoImagen";

ALTER TABLE "ProductoImagen" ADD COLUMN "mediaId" TEXT;
UPDATE "ProductoImagen" pi SET "mediaId" = m."id" FROM "Media" m WHERE m."key" = pi."key";
ALTER TABLE "ProductoImagen" ALTER COLUMN "mediaId" SET NOT NULL;

ALTER TABLE "ProductoImagen" DROP COLUMN "key", DROP COLUMN "alt";

CREATE UNIQUE INDEX "ProductoImagen_productoId_mediaId_key" ON "ProductoImagen"("productoId", "mediaId");
CREATE INDEX "ProductoImagen_mediaId_idx" ON "ProductoImagen"("mediaId");
-- `Restrict`: sacarla de un producto no la borra de la biblioteca, y borrarla
-- de la biblioteca no se puede mientras algún producto la use.
ALTER TABLE "ProductoImagen"
  ADD CONSTRAINT "ProductoImagen_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
