-- Los cobros de una factura propia.
--
-- Los de una factura de Contífico siguen viviendo allá: el portal los manda y
-- relee el saldo. Pero desde que emitimos sin ellos, una factura nuestra no
-- tiene dónde anotar un pago — y sin eso "Por cobrar" no puede decir nada.
--
-- No viajan a ningún lado. Al SRI la forma de pago se le declara **al emitir** y
-- el comprobante ya salió: esto es la cuenta corriente del vivero, no un dato
-- tributario. Por eso las formas de pago son las que usa la gente y no el
-- catálogo del SRI.

CREATE TYPE "FormaPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE', 'OTRO');

CREATE TABLE "Cobro" (
    "id" TEXT NOT NULL,
    "facturaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "formaPago" "FormaPago" NOT NULL,
    "referencia" TEXT,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdByNombre" TEXT,

    CONSTRAINT "Cobro_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Cobro_facturaId_idx" ON "Cobro"("facturaId");

-- `CASCADE`: los cobros son de la factura y no tienen sentido sin ella.
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_facturaId_fkey"
    FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- `SET NULL` y el nombre congelado aparte: quién lo registró es historia, y
-- borrar la cuenta no puede borrar el cobro.
ALTER TABLE "Cobro" ADD CONSTRAINT "Cobro_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
