-- `VisitaProducto.orden` no es la orden: es el lugar en la lista.
--
-- El nombre se leía como "a qué orden pertenece este producto", que es
-- exactamente lo que no significa —eso vive en `OrdenLinea.visitaProductoId`—
-- y ya nos hizo dudar de si un producto podía estar en varias órdenes.
-- `OrdenLinea` llamaba `posicion` a lo mismo desde el principio.
ALTER TABLE "VisitaProducto" RENAME COLUMN "orden" TO "posicion";
