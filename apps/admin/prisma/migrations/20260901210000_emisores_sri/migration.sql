-- Emisores del SRI: facturar sin pasar por Contífico.
--
-- Es una **tabla** y no una fila de configuración porque el vivero factura con
-- más de un RUC y elige cuál al emitir. Para el SRI cada RUC es un
-- contribuyente distinto: su propio certificado de firma, su propia numeración
-- y su propio trámite de habilitación de ambiente.
--
-- El `.p12` se guarda **cifrado** (AES-256-GCM, clave en el entorno). Es una
-- clave privada que firma documentos tributarios en nombre de la empresa: no
-- sale por ninguna API y solo la lee el servidor al firmar.

CREATE TYPE "AmbienteSri" AS ENUM ('PRUEBAS', 'PRODUCCION');

CREATE TABLE "Emisor" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreComercial" TEXT,
    "dirMatriz" TEXT NOT NULL,
    "direccionEstablecimiento" TEXT NOT NULL,
    "establecimiento" TEXT NOT NULL DEFAULT '001',
    "puntoEmision" TEXT NOT NULL DEFAULT '001',
    "obligadoContabilidad" BOOLEAN NOT NULL DEFAULT true,
    "contribuyenteEspecial" TEXT,
    "agenteRetencion" TEXT,
    "ambiente" "AmbienteSri" NOT NULL DEFAULT 'PRUEBAS',
    "certificado" BYTEA,
    "certificadoPassword" BYTEA,
    "certificadoSujeto" TEXT,
    "certificadoVence" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "predeterminado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emisor_pkey" PRIMARY KEY ("id")
);

-- El RUC es la identidad del emisor ante el SRI: dos filas con el mismo RUC
-- serían dos numeraciones para la misma serie, y el SRI rechaza los repetidos.
CREATE UNIQUE INDEX "Emisor_ruc_key" ON "Emisor"("ruc");
CREATE INDEX "Emisor_activo_idx" ON "Emisor"("activo");

-- La numeración de cada serie. Por tipo de comprobante también: una factura y
-- una nota de crédito llevan series distintas.
CREATE TABLE "SecuencialSri" (
    "id" TEXT NOT NULL,
    "emisorId" TEXT NOT NULL,
    "establecimiento" TEXT NOT NULL,
    "puntoEmision" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "valor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SecuencialSri_pkey" PRIMARY KEY ("id")
);

-- Lo que hace que dos emisiones simultáneas no pidan el mismo número: la fila
-- es una sola y se incrementa con UPDATE ... RETURNING.
CREATE UNIQUE INDEX "SecuencialSri_emisorId_establecimiento_puntoEmision_tipoDoc_key"
    ON "SecuencialSri"("emisorId", "establecimiento", "puntoEmision", "tipoDocumento");

ALTER TABLE "SecuencialSri" ADD CONSTRAINT "SecuencialSri_emisorId_fkey"
    FOREIGN KEY ("emisorId") REFERENCES "Emisor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo que el SRI devuelve, en la factura que ya existe.
ALTER TABLE "Factura" ADD COLUMN "emisorId" TEXT;
ALTER TABLE "Factura" ADD COLUMN "claveAcceso" TEXT;
ALTER TABLE "Factura" ADD COLUMN "ambienteSri" "AmbienteSri";
ALTER TABLE "Factura" ADD COLUMN "estadoSri" TEXT;
ALTER TABLE "Factura" ADD COLUMN "fechaAutorizacion" TIMESTAMP(3);
ALTER TABLE "Factura" ADD COLUMN "xmlKey" TEXT;
ALTER TABLE "Factura" ADD COLUMN "mensajesSri" JSONB;

-- En el esquema offline la clave de acceso **es** el número de autorización, y
-- no puede repetirse.
CREATE UNIQUE INDEX "Factura_claveAcceso_key" ON "Factura"("claveAcceso");

-- `RESTRICT`: un emisor con facturas emitidas no se borra — esas facturas
-- salieron a nombre suyo y el dato tiene que seguir ahí.
ALTER TABLE "Factura" ADD CONSTRAINT "Factura_emisorId_fkey"
    FOREIGN KEY ("emisorId") REFERENCES "Emisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
