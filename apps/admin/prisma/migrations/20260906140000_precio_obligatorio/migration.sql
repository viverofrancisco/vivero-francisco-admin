-- El precio de la variante pasa a ser obligatorio, y **cero quiere decir
-- gratis**.
--
-- Era nulable para distinguir "se cotiza al vender" de "no cuesta nada". Se
-- decidió que esa distinción no hace falta: toda variante tiene un precio,
-- aunque sea ninguno, y quien quiera cobrar otra cosa lo cambia en la orden —
-- que es donde vive lo que se cobró.
--
-- Lo que hoy es nulo pasa a cero: nadie le había puesto precio, y cero es
-- exactamente lo que la lista va a proponer hasta que alguien lo haga.
UPDATE "Variante" SET "precio" = 0 WHERE "precio" IS NULL;
ALTER TABLE "Variante" ALTER COLUMN "precio" SET DEFAULT 0;
ALTER TABLE "Variante" ALTER COLUMN "precio" SET NOT NULL;
