-- Saldo de la factura, espejado desde Contífico.
--
-- Los cobros son suyos y no se duplican acá: esto es solo el número que
-- devuelve el documento, para poder mostrar cuánto falta sin salir a pedirlo.
-- Arranca igual al total porque una factura recién emitida no tiene cobros.
ALTER TABLE "Factura" ADD COLUMN "saldo" DECIMAL(10,2);
