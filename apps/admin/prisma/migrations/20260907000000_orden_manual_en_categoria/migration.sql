-- El orden a mano de los productos dentro de una categoría.
--
-- Es el **orden guardado**: los demás —por nombre, por precio, por fecha— son
-- formas de mirar la lista y viven en la pantalla, porque sin una vidriera que
-- los consuma guardarlos sería una columna que nadie lee.
--
-- Lo que ya existe arranca ordenado por nombre, que es como se venía mostrando:
-- así el orden manual empieza donde la pantalla lo dejó y no en un revoltijo.
ALTER TABLE "ProductoCategoria" ADD COLUMN "posicion" INTEGER NOT NULL DEFAULT 0;

UPDATE "ProductoCategoria" pc
SET "posicion" = orden.fila - 1
FROM (
  SELECT pc2."productoId", pc2."categoriaId",
         row_number() OVER (PARTITION BY pc2."categoriaId" ORDER BY p."nombre") AS fila
  FROM "ProductoCategoria" pc2
  JOIN "Producto" p ON p."id" = pc2."productoId"
) AS orden
WHERE orden."productoId" = pc."productoId"
  AND orden."categoriaId" = pc."categoriaId";

DROP INDEX IF EXISTS "ProductoCategoria_categoriaId_idx";
CREATE INDEX "ProductoCategoria_categoriaId_posicion_idx" ON "ProductoCategoria"("categoriaId", "posicion");
