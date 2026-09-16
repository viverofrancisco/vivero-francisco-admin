-- La dirección deja de ser del cliente y pasa a ser de la propiedad.
--
-- Un cliente con dos casas tiene dos direcciones y ninguna de las dos es "la
-- suya"; el sector se muda por lo mismo, porque es geográfico y es del lugar.
-- Crear, rellenar y recién después borrar: cada cliente —incluidos los
-- archivados, porque sus visitas siguen apuntando a ellos— estrena una
-- propiedad "Principal" con lo que ya tenía cargado.

CREATE TABLE "Propiedad" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT,
    "sectorId" TEXT,
    "direccion" TEXT,
    "numeroCasa" TEXT,
    "referencia" TEXT,
    "notas" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "m2Total" DOUBLE PRECISION,
    "jardinerasPlantaAlta" BOOLEAN NOT NULL DEFAULT false,
    "numeroArboles" INTEGER,
    "mlVegetacionBaja" DOUBLE PRECISION,
    "mlVegetacionMedia" DOUBLE PRECISION,
    "mlVegetacionAlta" DOUBLE PRECISION,
    "m2Cesped" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Propiedad_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Propiedad_clienteId_idx" ON "Propiedad"("clienteId");
CREATE INDEX "Propiedad_sectorId_idx" ON "Propiedad"("sectorId");

ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_sectorId_fkey"
    FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Propiedad" ADD CONSTRAINT "Propiedad_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Una propiedad por cliente, con lo que el cliente ya tenía. El id se arma con
-- el del cliente para que la sentencia sea determinista y se pueda volver a
-- leer desde la actualización de Visita, sin tabla temporal.
INSERT INTO "Propiedad" (
    "id", "clienteId", "nombre", "ciudad", "sectorId", "direccion",
    "numeroCasa", "referencia", "m2Total", "createdAt", "updatedAt"
)
SELECT
    'prop_' || "id",
    "id",
    'Principal',
    "ciudad",
    "sectorId",
    "direccion",
    "numeroCasa",
    "referencia",
    "metrosCuadrados",
    "createdAt",
    CURRENT_TIMESTAMP
FROM "Cliente";

-- La visita pasa en una propiedad. Nace opcional para poder rellenarla.
ALTER TABLE "Visita" ADD COLUMN "propiedadId" TEXT;

UPDATE "Visita" SET "propiedadId" = 'prop_' || "clienteId";

ALTER TABLE "Visita" ALTER COLUMN "propiedadId" SET NOT NULL;
CREATE INDEX "Visita_propiedadId_idx" ON "Visita"("propiedadId");
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_propiedadId_fkey"
    FOREIGN KEY ("propiedadId") REFERENCES "Propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recién ahora: lo que se mudó se va del cliente.
ALTER TABLE "Cliente" DROP CONSTRAINT IF EXISTS "Cliente_sectorId_fkey";
DROP INDEX IF EXISTS "Cliente_sectorId_idx";
ALTER TABLE "Cliente"
    DROP COLUMN "ciudad",
    DROP COLUMN "sectorId",
    DROP COLUMN "direccion",
    DROP COLUMN "numeroCasa",
    DROP COLUMN "referencia",
    DROP COLUMN "metrosCuadrados";
