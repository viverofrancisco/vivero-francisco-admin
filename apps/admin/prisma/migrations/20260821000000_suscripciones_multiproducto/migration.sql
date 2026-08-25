-- ─────────────────────────────────────────────────────────────
-- ClienteServicio → Suscripcion (cabecera) + SuscripcionItem (líneas).
--
-- Además, lo que antes colgaba del contrato ahora cuelga del producto: una
-- visita, una foto y una sección de informe son *sobre un producto*, no sobre
-- un contrato. El contrato solo aporta el precio cuando es recurrente.
--
-- Escrita a mano: `migrate dev` haría drop + create y perdería los datos.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "Suscripcion" (
    "id"           TEXT NOT NULL,
    "clienteId"    TEXT NOT NULL,
    "estado"       "EstadoServicio" NOT NULL DEFAULT 'ACTIVO',
    "periodicidad" "Periodicidad" NOT NULL DEFAULT 'MENSUAL',
    "fechaInicio"  DATE NOT NULL,
    "fechaFin"     DATE,
    "notas"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "createdById"  TEXT,
    "updatedById"  TEXT,
    CONSTRAINT "Suscripcion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SuscripcionItem" (
    "id"                TEXT NOT NULL,
    "suscripcionId"     TEXT NOT NULL,
    "productoId"        TEXT NOT NULL,
    "precio"            DECIMAL(10,2) NOT NULL,
    "ivaTasa"           DECIMAL(5,2) NOT NULL DEFAULT 0,
    "frecuenciaMensual" INTEGER,
    CONSTRAINT "SuscripcionItem_pkey" PRIMARY KEY ("id")
);

-- 1) Una suscripción por cliente, agrupando todos sus productos recurrentes.
--    Se toma la fecha de inicio más temprana del grupo.
INSERT INTO "Suscripcion"
  ("id", "clienteId", "estado", "periodicidad", "fechaInicio", "createdAt", "updatedAt", "createdById", "updatedById")
SELECT
  gen_random_uuid()::text,
  cs."clienteId",
  -- Si al menos uno estaba activo, la suscripción nace activa.
  CASE WHEN bool_or(cs."estado" = 'ACTIVO') THEN 'ACTIVO'::"EstadoServicio"
       ELSE min(cs."estado")::text::"EstadoServicio" END,
  COALESCE(min(p."periodicidad")::text, 'MENSUAL')::"Periodicidad",
  min(cs."fechaInicio")::date,
  min(cs."createdAt"),
  max(cs."updatedAt"),
  min(cs."createdById"),
  min(cs."updatedById")
FROM "ClienteServicio" cs
JOIN "Producto" p ON p.id = cs."productoId"
WHERE p."modalidad" = 'SUSCRIPCION'
GROUP BY cs."clienteId";

-- 2) Un ítem por cada contrato recurrente.
INSERT INTO "SuscripcionItem"
  ("id", "suscripcionId", "productoId", "precio", "ivaTasa", "frecuenciaMensual")
SELECT
  gen_random_uuid()::text, s."id", cs."productoId", cs."precio",
  COALESCE(cs."ivaTasa", 0), cs."frecuenciaMensual"
FROM "ClienteServicio" cs
JOIN "Producto" p    ON p.id = cs."productoId"
JOIN "Suscripcion" s ON s."clienteId" = cs."clienteId"
WHERE p."modalidad" = 'SUSCRIPCION';

-- 3) VisitaServicio pasa a apuntar al producto.
ALTER TABLE "VisitaServicio" ADD COLUMN "productoId" TEXT;
ALTER TABLE "VisitaServicio" ADD COLUMN "suscripcionItemId" TEXT;

UPDATE "VisitaServicio" vs
SET "productoId" = cs."productoId"
FROM "ClienteServicio" cs
WHERE cs.id = vs."clienteServicioId";

UPDATE "VisitaServicio" vs
SET "suscripcionItemId" = si."id"
FROM "ClienteServicio" cs
JOIN "Suscripcion" s     ON s."clienteId" = cs."clienteId"
JOIN "SuscripcionItem" si ON si."suscripcionId" = s."id" AND si."productoId" = cs."productoId"
WHERE cs.id = vs."clienteServicioId";

ALTER TABLE "VisitaServicio" ALTER COLUMN "productoId" SET NOT NULL;

-- 4) Etiquetas de fotos y secciones de informe: del contrato al producto.
ALTER TABLE "VisitaMedia" ADD COLUMN "productoId" TEXT;
UPDATE "VisitaMedia" m
SET "productoId" = cs."productoId"
FROM "ClienteServicio" cs
WHERE cs.id = m."clienteServicioId";

ALTER TABLE "InformeSeccion" ADD COLUMN "productoId" TEXT;
UPDATE "InformeSeccion" i
SET "productoId" = cs."productoId"
FROM "ClienteServicio" cs
WHERE cs.id = i."clienteServicioId";

-- 5) OrdenLinea: la procedencia recurrente es el ítem de suscripción.
ALTER TABLE "OrdenLinea" ADD COLUMN "suscripcionItemId" TEXT;
UPDATE "OrdenLinea" ol
SET "suscripcionItemId" = si."id"
FROM "ClienteServicio" cs
JOIN "Suscripcion" s      ON s."clienteId" = cs."clienteId"
JOIN "SuscripcionItem" si ON si."suscripcionId" = s."id" AND si."productoId" = cs."productoId"
WHERE cs.id = ol."clienteServicioId";

-- 6) Recién ahora se borra lo viejo.
ALTER TABLE "VisitaServicio"  DROP CONSTRAINT "VisitaServicio_clienteServicioId_fkey";
ALTER TABLE "VisitaMedia"     DROP CONSTRAINT "VisitaMedia_clienteServicioId_fkey";
ALTER TABLE "InformeSeccion"  DROP CONSTRAINT "InformeSeccion_clienteServicioId_fkey";
ALTER TABLE "OrdenLinea"      DROP CONSTRAINT "OrdenLinea_clienteServicioId_fkey";

DROP INDEX IF EXISTS "VisitaServicio_visitaId_clienteServicioId_key";
DROP INDEX IF EXISTS "VisitaServicio_clienteServicioId_idx";
DROP INDEX IF EXISTS "VisitaMedia_clienteServicioId_idx";
DROP INDEX IF EXISTS "InformeSeccion_clienteServicioId_idx";
DROP INDEX IF EXISTS "OrdenLinea_clienteServicioId_periodoInicio_key";

ALTER TABLE "VisitaServicio" DROP COLUMN "clienteServicioId";
ALTER TABLE "VisitaMedia"    DROP COLUMN "clienteServicioId";
ALTER TABLE "InformeSeccion" DROP COLUMN "clienteServicioId";
ALTER TABLE "OrdenLinea"     DROP COLUMN "clienteServicioId";

DROP TABLE "ClienteServicio";

-- 7) Índices y claves foráneas nuevas.
CREATE INDEX "Suscripcion_clienteId_estado_idx" ON "Suscripcion"("clienteId", "estado");
CREATE UNIQUE INDEX "SuscripcionItem_suscripcionId_productoId_key" ON "SuscripcionItem"("suscripcionId", "productoId");
CREATE INDEX "SuscripcionItem_productoId_idx" ON "SuscripcionItem"("productoId");
CREATE UNIQUE INDEX "VisitaServicio_visitaId_productoId_key" ON "VisitaServicio"("visitaId", "productoId");
CREATE INDEX "VisitaServicio_productoId_idx" ON "VisitaServicio"("productoId");
CREATE INDEX "VisitaServicio_suscripcionItemId_idx" ON "VisitaServicio"("suscripcionItemId");
CREATE INDEX "VisitaMedia_productoId_idx" ON "VisitaMedia"("productoId");
CREATE INDEX "InformeSeccion_productoId_idx" ON "InformeSeccion"("productoId");
CREATE UNIQUE INDEX "OrdenLinea_suscripcionItemId_periodoInicio_key" ON "OrdenLinea"("suscripcionItemId", "periodoInicio");

ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SuscripcionItem" ADD CONSTRAINT "SuscripcionItem_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuscripcionItem" ADD CONSTRAINT "SuscripcionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisitaServicio" ADD CONSTRAINT "VisitaServicio_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisitaServicio" ADD CONSTRAINT "VisitaServicio_suscripcionItemId_fkey" FOREIGN KEY ("suscripcionItemId") REFERENCES "SuscripcionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VisitaMedia" ADD CONSTRAINT "VisitaMedia_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InformeSeccion" ADD CONSTRAINT "InformeSeccion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrdenLinea" ADD CONSTRAINT "OrdenLinea_suscripcionItemId_fkey" FOREIGN KEY ("suscripcionItemId") REFERENCES "SuscripcionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
