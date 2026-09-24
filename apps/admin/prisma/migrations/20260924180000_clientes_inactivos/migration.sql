-- Un cliente se puede marcar inactivo: no se le agendan visitas y sale
-- atenuado en los selectores, pero conserva su historial. `NULL` = activo.
ALTER TABLE "Cliente" ADD COLUMN "inactivoDesde" TIMESTAMP(3);
