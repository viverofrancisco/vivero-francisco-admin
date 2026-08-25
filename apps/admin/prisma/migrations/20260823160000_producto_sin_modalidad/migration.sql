-- Lo recurrente es del contrato, no del catálogo.
--
-- `Producto.modalidad` obligaba a decidir de una vez y para todos los clientes
-- si algo se vende suelto o por suscripción, y eso depende del cliente: el mismo
-- desmalezado es un trabajo puntual para uno y un plan mensual para otro. Es el
-- mismo error que ya se corrigió con `Producto.periodicidad`.
--
-- Lo que la columna protegía —que no se facture a mano algo ya cubierto por un
-- plan— pasa a resolverse por cliente en `orden.service.ts`: se rechaza la línea
-- sin procedencia cuando **ese** cliente tiene una suscripción activa con ese
-- producto. Es más preciso, porque antes bastaba con la etiqueta global.
ALTER TABLE "Producto" DROP COLUMN "modalidad";
DROP TYPE "ModalidadVenta";
