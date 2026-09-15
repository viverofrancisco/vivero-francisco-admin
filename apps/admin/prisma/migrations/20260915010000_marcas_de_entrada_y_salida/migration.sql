-- La entrada y la salida pasan a ser un momento, y traen dónde se marcó.
--
-- Eran texto `"HH:MM"` que alguien tipeaba. Ahora el jardinero aprieta un botón
-- y se sella el instante, y un instante necesita fecha: quien entra a las 23:50
-- y sale a las 00:30 tenía una salida anterior a su entrada.
--
-- La conversión toma la hora escrita y la planta sobre `fechaProgramada`, que
-- es el día en que se trabajó. `fechaProgramada` es `date`, así que sumarle la
-- hora da un `timestamp` local del día correcto. Lo que no se puede recuperar
-- es la zona: se guarda tal cual estaba escrito, que es lo que la oficina
-- venía leyendo.
--
-- Una salida menor que la entrada es alguien que cruzó la medianoche, y en el
-- texto viejo eso no se distinguía de un error de tipeo. Se le suma un día:
-- es la única lectura que deja la salida después de la entrada.
ALTER TABLE "VisitaPersonal"
  ADD COLUMN "entradaEl"        TIMESTAMP(3),
  ADD COLUMN "salidaEl"         TIMESTAMP(3),
  ADD COLUMN "entradaLat"       DOUBLE PRECISION,
  ADD COLUMN "entradaLng"       DOUBLE PRECISION,
  ADD COLUMN "entradaPrecision" DOUBLE PRECISION,
  ADD COLUMN "entradaSimulada"  BOOLEAN,
  ADD COLUMN "salidaLat"        DOUBLE PRECISION,
  ADD COLUMN "salidaLng"        DOUBLE PRECISION,
  ADD COLUMN "salidaPrecision"  DOUBLE PRECISION,
  ADD COLUMN "salidaSimulada"   BOOLEAN;

UPDATE "VisitaPersonal" vp
SET "entradaEl" = v."fechaProgramada" + vp."horaEntrada"::time
FROM "Visita" v
WHERE v."id" = vp."visitaId"
  AND vp."horaEntrada" ~ '^[0-2][0-9]:[0-5][0-9]$';

UPDATE "VisitaPersonal" vp
SET "salidaEl" = v."fechaProgramada" + vp."horaSalida"::time
     + CASE
         WHEN vp."horaEntrada" ~ '^[0-2][0-9]:[0-5][0-9]$'
          AND vp."horaSalida"::time < vp."horaEntrada"::time
         THEN INTERVAL '1 day'
         ELSE INTERVAL '0'
       END
FROM "Visita" v
WHERE v."id" = vp."visitaId"
  AND vp."horaSalida" ~ '^[0-2][0-9]:[0-5][0-9]$';

ALTER TABLE "VisitaPersonal" DROP COLUMN "horaEntrada", DROP COLUMN "horaSalida";
