-- El nombre de quien completó y de quien editó, congelado.
--
-- Los ids se quedan: sirven para filtrar por persona. Lo que no pueden hacer
-- es *contar lo que pasó*: si la cuenta se elimina el id queda en NULL, y si
-- alguien se cambia el apellido el registro histórico cambia con él. Por eso
-- va también el texto, como ya se hace con las facturas y las líneas de orden.
--
-- Las filas viejas quedan en NULL: no hay nombre que congelar retroactivamente
-- salvo el actual, que es justo el que no queremos suponer.
ALTER TABLE "Visita" ADD COLUMN "updatedByNombre" TEXT;
ALTER TABLE "Visita" ADD COLUMN "completadaPorNombre" TEXT;
