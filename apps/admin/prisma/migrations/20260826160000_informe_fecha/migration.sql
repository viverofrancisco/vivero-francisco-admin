-- La fecha que sale impresa en el informe, aparte de cuándo se generó.
--
-- Los que ya existen se rellenan con el día en que se generaron, que es lo que
-- venían imprimiendo: `render` usaba `new Date()` al momento de armar el PDF.
ALTER TABLE "Informe" ADD COLUMN "fecha" DATE;

UPDATE "Informe" SET "fecha" = "generatedAt"::date WHERE "fecha" IS NULL;

ALTER TABLE "Informe" ALTER COLUMN "fecha" SET NOT NULL;
