-- El horario de una ubicación deja de ser texto libre y pasa a ser uno por
-- día: siete `{ abierto, desde, hasta }` de lunes a domingo, que la app resume
-- ("Lun–Vie 8:00–17:00 · Sáb 8:00–13:00 · Dom cerrado"). La columna de texto
-- se creó hoy mismo y nunca llegó a producción: no hay nada que convertir.
ALTER TABLE "Ubicacion" DROP COLUMN "horario",
ADD COLUMN "horarios" JSONB;
