-- Variantes, inventario, imágenes y categorías múltiples.
--
-- Tres cosas de golpe porque se tocan entre sí: la variante es lo que se
-- cuenta, la imagen es del producto y la variante elige la suya, y la
-- categoría deja de ser un casillero para ser una lista.

-- ── Categorías: de una columna a una tabla puente ──────────────────────────
-- Era una sola categoría por producto. Un rosal es "Plantas" y también
-- "Exterior", y con un casillero había que elegir cuál de las dos guardar.
CREATE TABLE "ProductoCategoria" (
    "productoId"  TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    CONSTRAINT "ProductoCategoria_pkey" PRIMARY KEY ("productoId", "categoriaId")
);
CREATE INDEX "ProductoCategoria_categoriaId_idx" ON "ProductoCategoria"("categoriaId");
ALTER TABLE "ProductoCategoria"
  ADD CONSTRAINT "ProductoCategoria_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProductoCategoria_categoriaId_fkey"
    FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo que había, tal cual: cada producto con categoría pasa a tener esa una.
INSERT INTO "ProductoCategoria" ("productoId", "categoriaId")
SELECT "id", "categoriaId" FROM "Producto" WHERE "categoriaId" IS NOT NULL;

DROP INDEX IF EXISTS "Producto_categoriaId_idx";
ALTER TABLE "Producto" DROP CONSTRAINT IF EXISTS "Producto_categoriaId_fkey";
ALTER TABLE "Producto" DROP COLUMN "categoriaId";

-- ── Imágenes del producto ──────────────────────────────────────────────────
CREATE TABLE "ProductoImagen" (
    "id"         TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "key"        TEXT NOT NULL,
    "alt"        TEXT,
    "posicion"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductoImagen_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductoImagen_productoId_posicion_idx" ON "ProductoImagen"("productoId", "posicion");
ALTER TABLE "ProductoImagen"
  ADD CONSTRAINT "ProductoImagen_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Opciones y sus valores ─────────────────────────────────────────────────
CREATE TABLE "OpcionProducto" (
    "id"         TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombre"     TEXT NOT NULL,
    "posicion"   INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OpcionProducto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OpcionProducto_productoId_nombre_key" ON "OpcionProducto"("productoId", "nombre");
CREATE INDEX "OpcionProducto_productoId_idx" ON "OpcionProducto"("productoId");
ALTER TABLE "OpcionProducto"
  ADD CONSTRAINT "OpcionProducto_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ValorOpcion" (
    "id"       TEXT NOT NULL,
    "opcionId" TEXT NOT NULL,
    "valor"    TEXT NOT NULL,
    "posicion" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ValorOpcion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ValorOpcion_opcionId_valor_key" ON "ValorOpcion"("opcionId", "valor");
CREATE INDEX "ValorOpcion_opcionId_idx" ON "ValorOpcion"("opcionId");
ALTER TABLE "ValorOpcion"
  ADD CONSTRAINT "ValorOpcion_opcionId_fkey"
    FOREIGN KEY ("opcionId") REFERENCES "OpcionProducto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Variantes ──────────────────────────────────────────────────────────────
-- `combinacion` es lo que hace que el índice único pueda existir: con la tabla
-- puente sola, "no dos variantes con los mismos valores" no se puede expresar
-- en SQL.
CREATE TABLE "Variante" (
    "id"               TEXT NOT NULL,
    "productoId"       TEXT NOT NULL,
    "sku"              TEXT,
    "posicion"         INTEGER NOT NULL DEFAULT 0,
    "combinacion"      TEXT NOT NULL DEFAULT '',
    "manejaInventario" BOOLEAN NOT NULL DEFAULT true,
    "stock"            INTEGER NOT NULL DEFAULT 0,
    "permiteNegativo"  BOOLEAN NOT NULL DEFAULT false,
    "imagenId"         TEXT,
    CONSTRAINT "Variante_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Variante_sku_key" ON "Variante"("sku");
CREATE UNIQUE INDEX "Variante_productoId_combinacion_key" ON "Variante"("productoId", "combinacion");
CREATE INDEX "Variante_productoId_idx" ON "Variante"("productoId");
CREATE INDEX "Variante_imagenId_idx" ON "Variante"("imagenId");
ALTER TABLE "Variante"
  ADD CONSTRAINT "Variante_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Variante_imagenId_fkey"
    FOREIGN KEY ("imagenId") REFERENCES "ProductoImagen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VarianteValor" (
    "varianteId" TEXT NOT NULL,
    "valorId"    TEXT NOT NULL,
    CONSTRAINT "VarianteValor_pkey" PRIMARY KEY ("varianteId", "valorId")
);
CREATE INDEX "VarianteValor_valorId_idx" ON "VarianteValor"("valorId");
ALTER TABLE "VarianteValor"
  ADD CONSTRAINT "VarianteValor_varianteId_fkey"
    FOREIGN KEY ("varianteId") REFERENCES "Variante"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "VarianteValor_valorId_fkey"
    FOREIGN KEY ("valorId") REFERENCES "ValorOpcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Todo bien existente arranca con su variante única, sin opciones, heredando
-- el código del producto como SKU. Así "cuánto hay" mira siempre al mismo
-- lado, haya opciones o no, y no hay un bien sin dónde contar.
--
-- `manejaInventario` en false: nadie declaró todavía que quiera contar estos,
-- y prender el conteo solo es peor que dejarlo apagado — un stock en 0 que
-- nadie cargó bloquea ventas.
INSERT INTO "Variante" ("id", "productoId", "sku", "manejaInventario")
SELECT gen_random_uuid()::text, "id", "codigo", false
FROM "Producto" WHERE "tipo" = 'BIEN';

-- ── El libro de movimientos ────────────────────────────────────────────────
CREATE TYPE "MotivoMovimiento" AS ENUM ('INGRESO', 'AJUSTE', 'CONTEO', 'VENTA', 'DEVOLUCION');

CREATE TABLE "MovimientoInventario" (
    "id"              TEXT NOT NULL,
    "varianteId"      TEXT NOT NULL,
    "cantidad"        INTEGER NOT NULL,
    "saldo"           INTEGER NOT NULL,
    "motivo"          "MotivoMovimiento" NOT NULL,
    "nota"            TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById"     TEXT,
    "createdByNombre" TEXT,
    CONSTRAINT "MovimientoInventario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MovimientoInventario_varianteId_createdAt_idx" ON "MovimientoInventario"("varianteId", "createdAt");
ALTER TABLE "MovimientoInventario"
  ADD CONSTRAINT "MovimientoInventario_varianteId_fkey"
    FOREIGN KEY ("varianteId") REFERENCES "Variante"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MovimientoInventario_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
