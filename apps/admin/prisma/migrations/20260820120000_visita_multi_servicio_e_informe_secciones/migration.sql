-- ─────────────────────────────────────────────────────────────
-- 1) Visita: FK directo al cliente (antes se derivaba vía ClienteServicio)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "Visita" ADD COLUMN "clienteId" TEXT;

UPDATE "Visita" v
SET "clienteId" = cs."clienteId"
FROM "ClienteServicio" cs
WHERE cs."id" = v."clienteServicioId";

-- ─────────────────────────────────────────────────────────────
-- 2) VisitaServicio: una visita puede cubrir varios servicios
-- ─────────────────────────────────────────────────────────────
CREATE TABLE "VisitaServicio" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "clienteServicioId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VisitaServicio_pkey" PRIMARY KEY ("id")
);

-- Backfill: cada visita existente pasa a tener exactamente un servicio.
INSERT INTO "VisitaServicio" ("id", "visitaId", "clienteServicioId", "orden")
SELECT gen_random_uuid()::text, v."id", v."clienteServicioId", 0
FROM "Visita" v
WHERE v."clienteServicioId" IS NOT NULL;

-- Ya backfilleado: ahora sí puede ser obligatorio.
ALTER TABLE "Visita" ALTER COLUMN "clienteId" SET NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3) VisitaMedia: etiqueta opcional de servicio
--    Backfill sin ambigüedad: antes cada visita tenía un solo servicio.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "VisitaMedia" ADD COLUMN "clienteServicioId" TEXT;

UPDATE "VisitaMedia" m
SET "clienteServicioId" = v."clienteServicioId"
FROM "Visita" v
WHERE v."id" = m."visitaId" AND v."clienteServicioId" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 4) InformeSeccion: se origina en un servicio en vez de un tipo de actividad.
--    Las secciones existentes quedan como personalizadas (clienteServicioId NULL);
--    conservan su título y descripción, que ya estaban copiados en la fila.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "InformeSeccion" ADD COLUMN "clienteServicioId" TEXT;

CREATE TABLE "InformeSeccionFoto" (
    "id" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visitaMediaId" TEXT,

    CONSTRAINT "InformeSeccionFoto_pkey" PRIMARY KEY ("id")
);

-- Backfill: InformeSeccion."mediaIds" era un String[] de VisitaMedia.id en orden.
INSERT INTO "InformeSeccionFoto" ("id", "seccionId", "orden", "key", "url", "visitaMediaId")
SELECT gen_random_uuid()::text, s."id", (mid.ord - 1)::int, m."key", m."url", m."id"
FROM "InformeSeccion" s
CROSS JOIN LATERAL unnest(s."mediaIds") WITH ORDINALITY AS mid(media_id, ord)
JOIN "VisitaMedia" m ON m."id" = mid.media_id;

-- ─────────────────────────────────────────────────────────────
-- 5) Ahora sí: eliminar lo viejo
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "InformeSeccion" DROP CONSTRAINT "InformeSeccion_tipoActividadId_fkey";
ALTER TABLE "Visita" DROP CONSTRAINT "Visita_clienteServicioId_fkey";

ALTER TABLE "InformeSeccion" DROP COLUMN "mediaIds", DROP COLUMN "tipoActividadId";
ALTER TABLE "Visita" DROP COLUMN "clienteServicioId";

DROP TABLE "TipoActividad";

-- ─────────────────────────────────────────────────────────────
-- 6) Índices y claves foráneas
-- ─────────────────────────────────────────────────────────────
CREATE INDEX "VisitaServicio_clienteServicioId_idx" ON "VisitaServicio"("clienteServicioId");
CREATE UNIQUE INDEX "VisitaServicio_visitaId_clienteServicioId_key" ON "VisitaServicio"("visitaId", "clienteServicioId");
CREATE INDEX "InformeSeccionFoto_seccionId_orden_idx" ON "InformeSeccionFoto"("seccionId", "orden");
CREATE INDEX "InformeSeccionFoto_visitaMediaId_idx" ON "InformeSeccionFoto"("visitaMediaId");
CREATE INDEX "InformeSeccion_clienteServicioId_idx" ON "InformeSeccion"("clienteServicioId");
CREATE INDEX "Visita_clienteId_idx" ON "Visita"("clienteId");
CREATE INDEX "Visita_fechaProgramada_idx" ON "Visita"("fechaProgramada");
CREATE INDEX "VisitaMedia_visitaId_idx" ON "VisitaMedia"("visitaId");
CREATE INDEX "VisitaMedia_clienteServicioId_idx" ON "VisitaMedia"("clienteServicioId");

ALTER TABLE "Visita" ADD CONSTRAINT "Visita_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitaServicio" ADD CONSTRAINT "VisitaServicio_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitaServicio" ADD CONSTRAINT "VisitaServicio_clienteServicioId_fkey" FOREIGN KEY ("clienteServicioId") REFERENCES "ClienteServicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisitaMedia" ADD CONSTRAINT "VisitaMedia_clienteServicioId_fkey" FOREIGN KEY ("clienteServicioId") REFERENCES "ClienteServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InformeSeccion" ADD CONSTRAINT "InformeSeccion_clienteServicioId_fkey" FOREIGN KEY ("clienteServicioId") REFERENCES "ClienteServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InformeSeccionFoto" ADD CONSTRAINT "InformeSeccionFoto_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "InformeSeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InformeSeccionFoto" ADD CONSTRAINT "InformeSeccionFoto_visitaMediaId_fkey" FOREIGN KEY ("visitaMediaId") REFERENCES "VisitaMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
