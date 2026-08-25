-- Datos de facturación por cliente.
--
-- Hasta ahora la identificación vivía suelta en Cliente (`cedula`, `ruc`,
-- `tipoPersona`), lo que permitía una sola forma de facturar. Un mismo contacto
-- puede necesitar más de una: a nombre propio y al de su empresa, o a razones
-- sociales distintas.
--
-- Los campos viejos de Cliente **no se borran acá**: se dejan hasta confirmar
-- que el backfill quedó bien contra datos reales. Se quitan en otra migración.

CREATE TYPE "TipoIdentificacion" AS ENUM ('CEDULA', 'RUC');

CREATE TABLE "DatoFacturacion" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipoIdentificacion" "TipoIdentificacion" NOT NULL,
    "identificacion" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "tipoPersona" "TipoPersona" NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "esPredeterminado" BOOLEAN NOT NULL DEFAULT false,
    "archivado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "DatoFacturacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DatoFacturacion_clienteId_identificacion_key"
  ON "DatoFacturacion"("clienteId", "identificacion");
CREATE INDEX "DatoFacturacion_clienteId_archivado_idx"
  ON "DatoFacturacion"("clienteId", "archivado");

ALTER TABLE "DatoFacturacion"
  ADD CONSTRAINT "DatoFacturacion_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DatoFacturacion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DatoFacturacion_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: un dato por cliente que ya tenga identificación cargada.
--
-- La razón social sale de `empresa` si existe (es lo que se factura a una
-- jurídica) y si no del nombre completo. El tipo se deriva de qué campo estaba
-- lleno: quien tiene RUC es jurídica salvo que ya estuviera marcado.
INSERT INTO "DatoFacturacion" (
  "id", "clienteId", "tipoIdentificacion", "identificacion", "razonSocial",
  "tipoPersona", "direccion", "telefono", "email", "esPredeterminado",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  CASE WHEN c."ruc" IS NOT NULL AND c."ruc" <> '' THEN 'RUC'::"TipoIdentificacion"
       ELSE 'CEDULA'::"TipoIdentificacion" END,
  COALESCE(NULLIF(c."ruc", ''), c."cedula"),
  COALESCE(
    NULLIF(TRIM(c."empresa"), ''),
    NULLIF(TRIM(CONCAT_WS(' ', c."nombre", c."apellido")), ''),
    'Sin razón social'
  ),
  COALESCE(
    c."tipoPersona",
    CASE WHEN c."ruc" IS NOT NULL AND c."ruc" <> '' THEN 'JURIDICA'::"TipoPersona"
         ELSE 'NATURAL'::"TipoPersona" END
  ),
  c."direccion",
  c."telefono",
  c."email",
  true,
  NOW(),
  NOW()
FROM "Cliente" c
WHERE c."deletedAt" IS NULL
  AND COALESCE(NULLIF(c."ruc", ''), NULLIF(c."cedula", '')) IS NOT NULL;

-- Con qué datos se emitió cada factura, y el snapshot de lo impreso.
ALTER TABLE "Factura"
  ADD COLUMN "datoFacturacionId" TEXT,
  ADD COLUMN "razonSocial" TEXT,
  ADD COLUMN "identificacion" TEXT;

ALTER TABLE "Factura"
  ADD CONSTRAINT "Factura_datoFacturacionId_fkey"
  FOREIGN KEY ("datoFacturacionId") REFERENCES "DatoFacturacion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
