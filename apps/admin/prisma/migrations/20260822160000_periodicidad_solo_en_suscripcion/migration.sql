-- La periodicidad es del contrato, no del catálogo.
--
-- `Producto.periodicidad` solo servía para proponer un valor al armar una
-- suscripción, y sugería que el ciclo era una propiedad del producto. No lo es:
-- el mismo producto puede ser mensual para un cliente y trimestral para otro,
-- y esa es la razón por la que `Suscripcion.periodicidad` existe. Nada lee esta
-- columna para facturar ni para cubrir visitas.
ALTER TABLE "Producto" DROP COLUMN "periodicidad";
