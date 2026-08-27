-- Revocar el acceso de alguien sin borrar su cuenta: su nombre sigue firmando
-- las visitas e informes que hizo, pero no puede volver a entrar.
--
-- Fecha y no booleano: así también queda registrado *cuándo*, que es lo que se
-- pregunta después. NULL = tiene acceso, que es el estado de todos hoy.
ALTER TABLE "User" ADD COLUMN "accesoRevocadoEl" TIMESTAMP(3);
