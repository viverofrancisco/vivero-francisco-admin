-- Las fotos de un informe pasan por la biblioteca.
--
-- `key` y `url` siguen siendo **lo que se imprimió** —el PDF ya salió con esa
-- imagen— y `mediaId` dice de dónde vino, igual que `visitaMediaId` para las
-- que salen de una visita. De quién es el archivo decide quién lo borra.
ALTER TABLE "InformeSeccionFoto" ADD COLUMN "mediaId" TEXT;
CREATE INDEX "InformeSeccionFoto_mediaId_idx" ON "InformeSeccionFoto"("mediaId");
ALTER TABLE "InformeSeccionFoto"
  ADD CONSTRAINT "InformeSeccionFoto_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las que se subieron **al informe** entran a la biblioteca: son archivos que
-- nadie más tenía y que ahora se pueden reusar. Las que vienen de una visita no:
-- ese archivo es de la visita y sigue viviendo en su galería.
--
-- Una fila por `key` distinta, porque `Media.key` es único y la misma foto
-- puede estar repetida en dos secciones.
INSERT INTO "Media" ("id", "key", "nombre", "contentType", "createdAt")
SELECT
  gen_random_uuid()::text,
  f."key",
  regexp_replace(f."key", '^.*/', ''),
  CASE
    WHEN f."key" ILIKE '%.png'  THEN 'image/png'
    WHEN f."key" ILIKE '%.webp' THEN 'image/webp'
    WHEN f."key" ILIKE '%.gif'  THEN 'image/gif'
    WHEN f."key" ILIKE '%.avif' THEN 'image/avif'
    ELSE 'image/jpeg'
  END,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "key" FROM "InformeSeccionFoto" WHERE "visitaMediaId" IS NULL
) f
WHERE NOT EXISTS (SELECT 1 FROM "Media" m WHERE m."key" = f."key");

UPDATE "InformeSeccionFoto" f
SET "mediaId" = m."id"
FROM "Media" m
WHERE m."key" = f."key" AND f."visitaMediaId" IS NULL;
