-- Un estado nuevo para la visita a la que la cuadrilla fue y no hubo trabajo,
-- y la novedad que el jardinero reporta desde el jardín para contarlo.
--
-- NO_REALIZADA no es CANCELADA: cancelada se decide antes y nadie viaja; acá
-- hay un viaje hecho —nadie en casa, el portón cerrado, el cliente la canceló
-- en la puerta—, se puede cobrar, y no ocupa el día del cliente para que se
-- pueda volver esa misma tarde. Agregar un valor a un enum es un ADD VALUE;
-- no se usa en esta misma transacción, que es lo que Postgres exige.

ALTER TYPE "EstadoVisita" ADD VALUE 'NO_REALIZADA';

CREATE TYPE "MotivoNovedad" AS ENUM ('NADIE_EN_CASA', 'SIN_ACCESO', 'CLIENTE_CANCELO', 'OTRO');

-- Solo en NO_REALIZADA: el motivo de la lista cerrada. Y de qué visita es la
-- repetición, cuando se reprogramó una que no se pudo hacer.
ALTER TABLE "Visita"
  ADD COLUMN "motivoNoRealizada" "MotivoNovedad",
  ADD COLUMN "reprogramadaDeId" TEXT;

CREATE INDEX "Visita_reprogramadaDeId_idx" ON "Visita"("reprogramadaDeId");

ALTER TABLE "Visita"
  ADD CONSTRAINT "Visita_reprogramadaDeId_fkey"
  FOREIGN KEY ("reprogramadaDeId") REFERENCES "Visita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- "Llegué y no pude hacer la visita", con la misma evidencia que una marca.
-- Una por persona y por visita: un reintento sin señal no crea otra.
CREATE TABLE "VisitaNovedad" (
  "id"             TEXT NOT NULL,
  "visitaId"       TEXT NOT NULL,
  "personalId"     TEXT NOT NULL,
  "personalNombre" TEXT NOT NULL,
  "motivo"         "MotivoNovedad" NOT NULL,
  "nota"           TEXT,
  "fotoKey"        TEXT,
  "fotoUrl"        TEXT,
  "marcadaEl"      TIMESTAMP(3) NOT NULL,
  "recibidaEl"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sinConexion"    BOOLEAN NOT NULL DEFAULT false,
  "lat"            DOUBLE PRECISION,
  "lng"            DOUBLE PRECISION,
  "precision"      DOUBLE PRECISION,
  "simulada"       BOOLEAN,
  "dispositivo"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VisitaNovedad_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitaNovedad_visitaId_personalId_key" ON "VisitaNovedad"("visitaId", "personalId");
CREATE INDEX "VisitaNovedad_personalId_idx" ON "VisitaNovedad"("personalId");

ALTER TABLE "VisitaNovedad"
  ADD CONSTRAINT "VisitaNovedad_visitaId_fkey"
  FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitaNovedad"
  ADD CONSTRAINT "VisitaNovedad_personalId_fkey"
  FOREIGN KEY ("personalId") REFERENCES "Personal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
