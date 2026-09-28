-- Las fotos de una novedad pasan de una columna (una sola foto) a una tabla
-- hija (las que hagan falta), como los adjuntos de un mensaje del chat: con la
-- columna, la segunda foto reemplazaba a la primera.
--
-- El orden de siempre: crear lo nuevo, pasar lo que hay, y recién ahí borrar
-- lo viejo.

CREATE TABLE "VisitaNovedadFoto" (
  "id"        TEXT NOT NULL,
  "novedadId" TEXT NOT NULL,
  "key"       TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VisitaNovedadFoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitaNovedadFoto_novedadId_idx" ON "VisitaNovedadFoto"("novedadId");

ALTER TABLE "VisitaNovedadFoto"
  ADD CONSTRAINT "VisitaNovedadFoto_novedadId_fkey"
  FOREIGN KEY ("novedadId") REFERENCES "VisitaNovedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- La foto que cada novedad tenía, si tenía.
INSERT INTO "VisitaNovedadFoto" ("id", "novedadId", "key", "url", "createdAt")
SELECT "id" || '-foto', "id", "fotoKey", "fotoUrl", "createdAt"
FROM "VisitaNovedad"
WHERE "fotoKey" IS NOT NULL AND "fotoUrl" IS NOT NULL;

ALTER TABLE "VisitaNovedad"
  DROP COLUMN "fotoKey",
  DROP COLUMN "fotoUrl";
