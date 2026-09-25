-- Hacia dónde se arriman las fotos de una sección cuando la fila no se llena.
--
-- Con tres por fila y dos fotos queda un hueco, y hasta ahora iba siempre a la
-- derecha: las fotos se pegaban a la izquierda. Quien arma el informe elige
-- ahora si la última fila va a la izquierda, centrada o a la derecha; las filas
-- llenas no cambian. Nace con la alineación de siempre, así ningún informe
-- existente se ve distinto.
CREATE TYPE "AlineacionDeFotos" AS ENUM ('IZQUIERDA', 'CENTRO', 'DERECHA');

ALTER TABLE "InformeSeccion"
  ADD COLUMN "fotosAlineacion" "AlineacionDeFotos" NOT NULL DEFAULT 'IZQUIERDA';
