-- Control del layout, por sección.
--
-- Antes el PDF no tenía ninguna palanca: el título de una sección podía quedar
-- al pie de una hoja con sus fotos en la siguiente, y no había forma de decir
-- "esta empieza en página nueva". Los defaults son exactamente lo que se venía
-- imprimiendo, así que los informes viejos no cambian.
ALTER TABLE "InformeSeccion"
  ADD COLUMN "saltoDePagina" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mantenerJunta" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fotosPorFila" INTEGER NOT NULL DEFAULT 3;
