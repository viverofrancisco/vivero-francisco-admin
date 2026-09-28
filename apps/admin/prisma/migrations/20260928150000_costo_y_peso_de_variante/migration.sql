-- Costo y peso por variante, como en Shopify.
--
-- `costo` nace nulo: "no se sabe" no es cero, y un costo en cero diría que la
-- mercadería fue regalada. `peso` va con su unidad al lado, guardado como se
-- lo escribió (25 kg sigue leyéndose 25 kg), y la unidad tiene DEFAULT para
-- que las filas que ya existen no queden con una unidad vacía. Solo un bien
-- carga cualquiera de los dos; eso lo cuida el servicio, no la base, porque
-- el tipo vive en el producto y no en la variante.

CREATE TYPE "UnidadPeso" AS ENUM ('G', 'KG', 'LB', 'OZ');

ALTER TABLE "Variante"
  ADD COLUMN "costo"      DECIMAL(10,2),
  ADD COLUMN "peso"       DECIMAL(10,3),
  ADD COLUMN "pesoUnidad" "UnidadPeso" NOT NULL DEFAULT 'KG';
