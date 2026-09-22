-- El nombre con el que mandaron el archivo: es lo único por lo que se puede
-- buscar una foto, porque su clave en R2 es un uuid.
ALTER TABLE "ChatAdjunto" ADD COLUMN "nombre" TEXT;

-- Buscar mensajes recorre texto y nombres con ILIKE; sin esto son dos
-- recorridas de tabla por cada letra que alguien escribe en el buscador.
CREATE INDEX "ChatAdjunto_nombre_idx" ON "ChatAdjunto"("nombre");
