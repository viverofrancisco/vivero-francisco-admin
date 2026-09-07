-- Si el producto ya se puede vender.
--
-- `BORRADOR` es el que todavía se está armando: existe, se le cargan fotos y
-- variantes, pero no aparece en los selectores de una orden. Es lo que evita
-- que algo a medio configurar —sin precio, sin SKU— termine en una factura por
-- estar en la lista.
--
-- Todo lo que hay pasa a `ACTIVO`: es lo que venía haciendo el portal, que los
-- ofrecía todos.
CREATE TYPE "EstadoProducto" AS ENUM ('ACTIVO', 'BORRADOR');
ALTER TABLE "Producto" ADD COLUMN "estado" "EstadoProducto" NOT NULL DEFAULT 'ACTIVO';
