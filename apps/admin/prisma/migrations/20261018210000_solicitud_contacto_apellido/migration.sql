-- El apellido de quien pide sin cuenta: la visita que se agenda desde la
-- solicitud precarga *Cliente nuevo* con nombre y apellido por separado.
ALTER TABLE "SolicitudCliente" ADD COLUMN "contactoApellido" TEXT;
