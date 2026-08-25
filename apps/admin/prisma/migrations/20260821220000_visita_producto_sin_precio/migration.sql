-- VisitaServicio pasa a VisitaProducto, y deja de llevar plata.
--
-- Dos cambios que van juntos:
--
-- 1. El nombre. "Servicio" es vocabulario de antes del rename a Producto: la
--    tabla es el puente Visita × Producto, y eso es lo que dice ahora.
--
-- 2. Se van `precio` e `ivaTasa`. El dinero vive en `OrdenLinea` y en ningún
--    otro lado — era la premisa del libro de ventas único y esta tabla era la
--    excepción que quedaba. Un trabajo se cotiza al facturarlo, no al
--    agendarlo, que además es cuando se sabe el precio.
--
--    Lo que sí queda es `suscripcionItemId`: no es plata, es cobertura — dice
--    si el trabajo ya está pago por un plan o si hay que cobrarlo aparte.
--
-- `ALTER TABLE ... RENAME` conserva los datos; un drop + create los perdería.

ALTER TABLE "VisitaServicio" RENAME TO "VisitaProducto";

ALTER TABLE "VisitaProducto" DROP COLUMN "precio";
ALTER TABLE "VisitaProducto" DROP COLUMN "ivaTasa";

-- Índices y constraints arrastran el nombre viejo.
ALTER INDEX "VisitaServicio_pkey" RENAME TO "VisitaProducto_pkey";
ALTER INDEX "VisitaServicio_visitaId_productoId_key" RENAME TO "VisitaProducto_visitaId_productoId_key";
ALTER INDEX "VisitaServicio_productoId_idx" RENAME TO "VisitaProducto_productoId_idx";
ALTER INDEX "VisitaServicio_suscripcionItemId_idx" RENAME TO "VisitaProducto_suscripcionItemId_idx";

ALTER TABLE "VisitaProducto" RENAME CONSTRAINT "VisitaServicio_visitaId_fkey" TO "VisitaProducto_visitaId_fkey";
ALTER TABLE "VisitaProducto" RENAME CONSTRAINT "VisitaServicio_productoId_fkey" TO "VisitaProducto_productoId_fkey";
ALTER TABLE "VisitaProducto" RENAME CONSTRAINT "VisitaServicio_suscripcionItemId_fkey" TO "VisitaProducto_suscripcionItemId_fkey";

-- La referencia desde la línea de orden.
ALTER TABLE "OrdenLinea" RENAME COLUMN "visitaServicioId" TO "visitaProductoId";
ALTER INDEX "OrdenLinea_visitaServicioId_key" RENAME TO "OrdenLinea_visitaProductoId_key";
ALTER TABLE "OrdenLinea" RENAME CONSTRAINT "OrdenLinea_visitaServicioId_fkey" TO "OrdenLinea_visitaProductoId_fkey";
