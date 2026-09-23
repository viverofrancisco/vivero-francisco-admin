-- Cuándo llegó cada marca al servidor, y si el teléfono la hizo sin señal.
-- Las marcas de antes llegaron en el mismo instante en que se hicieron.
ALTER TABLE "VisitaPersonal"
  ADD COLUMN "entradaRecibidaEl" TIMESTAMP(3),
  ADD COLUMN "entradaSinConexion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "salidaRecibidaEl" TIMESTAMP(3),
  ADD COLUMN "salidaSinConexion" BOOLEAN NOT NULL DEFAULT false;
UPDATE "VisitaPersonal" SET "entradaRecibidaEl" = "entradaEl" WHERE "entradaEl" IS NOT NULL;
UPDATE "VisitaPersonal" SET "salidaRecibidaEl" = "salidaEl" WHERE "salidaEl" IS NOT NULL;
