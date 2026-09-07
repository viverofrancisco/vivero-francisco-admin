-- Los informes se pueden editar, y editarlos ya no pisa lo anterior.
--
-- Hasta acá un informe era inmutable: corregirlo era borrarlo y hacer otro, con
-- otro número, porque el cliente se quedaba con un PDF que dejaba de coincidir
-- con el nuestro. Guardar cada generación como una versión resuelve eso — el
-- archivo que él tiene sigue existiendo y se puede abrir— así que la edición
-- pasa a ser posible.

-- Quién y cuándo, en el informe.
ALTER TABLE "Informe"
  ADD COLUMN "generatedByNombre" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "updatedByNombre" TEXT,
  ADD COLUMN "versionActual" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Informe"
  ADD CONSTRAINT "Informe_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El nombre de quien lo creó, congelado. Se rellena con el que la cuenta tiene
-- hoy: es lo más cerca de la verdad que se puede reconstruir hacia atrás.
UPDATE "Informe" i
SET "generatedByNombre" = TRIM(CONCAT_WS(' ', u."name", u."apellido"))
FROM "User" u
WHERE u."id" = i."generatedById"
  AND TRIM(CONCAT_WS(' ', u."name", u."apellido")) <> '';

CREATE TABLE "InformeVersion" (
  "id" TEXT NOT NULL,
  "informeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "titulo" TEXT NOT NULL,
  "fecha" DATE NOT NULL,
  "pdfKey" TEXT NOT NULL,
  "pdfUrl" TEXT NOT NULL,
  "contenido" JSONB NOT NULL,
  "generatedById" TEXT,
  "generatedByNombre" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nota" TEXT,
  CONSTRAINT "InformeVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InformeVersion_informeId_version_key" ON "InformeVersion"("informeId", "version");
CREATE INDEX "InformeVersion_informeId_idx" ON "InformeVersion"("informeId");

ALTER TABLE "InformeVersion"
  ADD CONSTRAINT "InformeVersion_informeId_fkey"
  FOREIGN KEY ("informeId") REFERENCES "Informe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InformeVersion"
  ADD CONSTRAINT "InformeVersion_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cada informe que ya existe es su propia versión 1. Sin esto, un informe viejo
-- no tendría de dónde sacar el PDF entregado y la lista de versiones saldría
-- vacía para todos ellos.
--
-- `contenido` queda como un objeto vacío: lo que hace falta para *mirar* la
-- versión es el PDF, y el detalle de con qué se armó vive todavía en las tablas
-- vivas, porque nadie la editó nunca.
INSERT INTO "InformeVersion" (
  "id", "informeId", "version", "titulo", "fecha", "pdfKey", "pdfUrl",
  "contenido", "generatedById", "generatedByNombre", "generatedAt"
)
SELECT
  gen_random_uuid()::text, i."id", 1, i."titulo", i."fecha", i."pdfKey", i."pdfUrl",
  '{}'::jsonb, i."generatedById", i."generatedByNombre", i."generatedAt"
FROM "Informe" i;

CREATE TABLE "InformeBorrador" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT,
  "titulo" TEXT,
  "contenido" JSONB NOT NULL,
  "createdById" TEXT,
  "createdByNombre" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "updatedByNombre" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InformeBorrador_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InformeBorrador_updatedAt_idx" ON "InformeBorrador"("updatedAt");
CREATE INDEX "InformeBorrador_clienteId_idx" ON "InformeBorrador"("clienteId");

ALTER TABLE "InformeBorrador"
  ADD CONSTRAINT "InformeBorrador_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InformeBorrador"
  ADD CONSTRAINT "InformeBorrador_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InformeBorrador"
  ADD CONSTRAINT "InformeBorrador_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
