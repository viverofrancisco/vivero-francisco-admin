-- Quién subió cada foto de una visita.
--
-- El jardinero ve y borra **las suyas**, no las de sus compañeros: en una visita
-- de tres personas la grilla mezclaba el trabajo de todos, y cualquiera podía
-- borrar la foto que otro acababa de sacar. La oficina las ve todas —es la que
-- arma el informe— y el cliente también, porque son de su jardín.
--
-- Las filas que ya existen quedan en NULL: no sabemos quién las subió, y
-- inventarlo sería peor que decir que no se sabe. Las ve solo la oficina.
ALTER TABLE "VisitaMedia" ADD COLUMN "subidaPorId" TEXT;

CREATE INDEX "VisitaMedia_subidaPorId_idx" ON "VisitaMedia"("subidaPorId");

ALTER TABLE "VisitaMedia"
  ADD CONSTRAINT "VisitaMedia_subidaPorId_fkey"
  FOREIGN KEY ("subidaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
