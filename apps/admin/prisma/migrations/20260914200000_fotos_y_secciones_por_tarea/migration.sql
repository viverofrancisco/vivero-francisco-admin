-- La foto y la sección del informe se etiquetan con una **tarea**, no con un
-- producto.
--
-- Una foto de un jardín muestra un trabajo —el seto podado, la maleza sacada—,
-- no algo que se vende. La etiqueta era un producto del catálogo porque eso era
-- lo que la visita llevaba; desde que lleva tareas, el producto ahí no dice
-- nada. Y es lo que hace que el informe se arme solo: sus secciones salen de
-- las tareas que se hicieron en las visitas elegidas, y cada foto ya sabe a
-- cuál va.
--
-- **Lo que no se puede mapear se pierde, y está bien que así sea.** Un producto
-- y una tarea son catálogos distintos —"Plan de mantenimiento mensual" no es
-- "Poda de setos"— así que no hay traducción posible salvo cuando alguien puso
-- el mismo nombre en los dos lados. Eso se rescata abajo; el resto queda sin
-- etiquetar, que es un estado que la pantalla ya sabe mostrar. Una sección de
-- informe sin origen se lee como escrita a mano, y su título, su texto y su PDF
-- no se tocan: el documento emitido sigue siendo el mismo.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Columnas nuevas, al lado de las viejas
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "VisitaMedia"    ADD COLUMN "tareaId" TEXT;
ALTER TABLE "InformeSeccion" ADD COLUMN "tareaId" TEXT;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Backfill por nombre, sin tildes ni mayúsculas
--
-- `unaccent` no está instalada y no vale la pena una extensión para esto, así
-- que se comparan en minúsculas con `translate` sobre las vocales acentuadas,
-- que es lo único que aparece en estos nombres.
-- ──────────────────────────────────────────────────────────────────────────
UPDATE "VisitaMedia" vm
SET "tareaId" = t."id"
FROM "Producto" p, "Tarea" t
WHERE vm."productoId" = p."id"
  AND t."deletedAt" IS NULL
  AND translate(lower(trim(p."nombre")), 'áéíóúü', 'aeiouu')
    = translate(lower(trim(t."nombre")), 'áéíóúü', 'aeiouu');

UPDATE "InformeSeccion" s
SET "tareaId" = t."id"
FROM "Producto" p, "Tarea" t
WHERE s."productoId" = p."id"
  AND t."deletedAt" IS NULL
  AND translate(lower(trim(p."nombre")), 'áéíóúü', 'aeiouu')
    = translate(lower(trim(t."nombre")), 'áéíóúü', 'aeiouu');

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Recién ahora, borrar lo viejo
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "VisitaMedia"    DROP CONSTRAINT "VisitaMedia_productoId_fkey";
ALTER TABLE "InformeSeccion" DROP CONSTRAINT "InformeSeccion_productoId_fkey";
DROP INDEX "VisitaMedia_productoId_idx";
DROP INDEX "InformeSeccion_productoId_idx";
ALTER TABLE "VisitaMedia"    DROP COLUMN "productoId";
ALTER TABLE "InformeSeccion" DROP COLUMN "productoId";

CREATE INDEX "VisitaMedia_tareaId_idx"    ON "VisitaMedia"("tareaId");
CREATE INDEX "InformeSeccion_tareaId_idx" ON "InformeSeccion"("tareaId");

-- `SetNull` y no `Restrict`: eliminar una tarea es en blando, así que esto no
-- llega a dispararse; si algún día se borra en duro, la foto se queda sin
-- clasificar en vez de bloquear el borrado.
ALTER TABLE "VisitaMedia" ADD CONSTRAINT "VisitaMedia_tareaId_fkey"
  FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InformeSeccion" ADD CONSTRAINT "InformeSeccion_tareaId_fkey"
  FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
