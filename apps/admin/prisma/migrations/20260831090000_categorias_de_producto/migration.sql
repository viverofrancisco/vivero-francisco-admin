-- Categorías del catálogo, del portal.
--
-- No son un espejo de las de Contífico. Allá una categoría es configuración
-- **contable**: lleva la `cuenta_venta` y el producto la hereda, verificado el
-- 31/08/2026 —nuestros productos están en su categoría "General" y tienen su
-- misma cuenta—. Y su árbol es de ellos: en la cuenta de pruebas hay 2.939
-- categorías, casi todas de otros integradores.
--
-- Acá una categoría es lo que sirve para encontrar un producto en una lista.
-- Lo que une las dos caras es `contificoCategoriaId`: con qué categoría de
-- ellos se crean los productos de esta. Sin eso Contífico les pone la suya por
-- defecto, que es de tipo PROD, y un servicio termina contabilizado como venta
-- de bienes.

CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "contificoCategoriaId" TEXT,
    "contificoCategoriaNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- El nombre es la identidad de una categoría: dos "Insumos" son un error de
-- tipeo, no dos categorías.
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- Opcional en el producto: el catálogo que ya existe no tiene ninguna, y
-- obligarla habría dejado esas fichas sin poder guardarse.
ALTER TABLE "Producto" ADD COLUMN "categoriaId" TEXT;
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");

-- `SET NULL`: borrar una categoría reagrupa el catálogo, no se lleva productos
-- puestos — que están nombrados en visitas, órdenes y facturas.
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey"
    FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
