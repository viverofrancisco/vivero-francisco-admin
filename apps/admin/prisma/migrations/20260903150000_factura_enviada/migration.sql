-- Cuándo se le mandó la factura al cliente, y a qué correo.
--
-- Sin esto no hay forma de saber si le llegó, y el reflejo es volver a
-- mandarla "por si acaso" — que del lado del cliente es la misma factura dos
-- veces.
ALTER TABLE "Factura" ADD COLUMN "enviadoEl" TIMESTAMP(3);
ALTER TABLE "Factura" ADD COLUMN "enviadoA" TEXT;
