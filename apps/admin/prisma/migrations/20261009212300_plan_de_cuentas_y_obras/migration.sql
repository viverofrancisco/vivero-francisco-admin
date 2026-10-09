-- CreateEnum
CREATE TYPE "TipoCuentaContable" AS ENUM ('GRUPO', 'DETALLE');

-- CreateEnum
CREATE TYPE "TipoObra" AS ENUM ('OBRA', 'AREA');

-- CreateEnum
CREATE TYPE "EstadoObra" AS ENUM ('EN_CURSO', 'TERMINADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "CuentaContable" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuentaContable" NOT NULL,
    "padreId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "contificoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CuentaContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoObra" NOT NULL DEFAULT 'OBRA',
    "estado" "EstadoObra" NOT NULL DEFAULT 'EN_CURSO',
    "clienteId" TEXT,
    "propiedadId" TEXT,
    "presupuesto" DECIMAL(12,2),
    "fechaInicio" DATE,
    "fechaFin" DATE,
    "notas" TEXT,
    "contificoCodigo" TEXT,
    "contificoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "updatedByNombre" TEXT,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaContable_codigo_key" ON "CuentaContable"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaContable_contificoId_key" ON "CuentaContable"("contificoId");

-- CreateIndex
CREATE INDEX "CuentaContable_padreId_idx" ON "CuentaContable"("padreId");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_numero_key" ON "Obra"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_contificoId_key" ON "Obra"("contificoId");

-- CreateIndex
CREATE INDEX "Obra_clienteId_idx" ON "Obra"("clienteId");

-- CreateIndex
CREATE INDEX "Obra_estado_idx" ON "Obra"("estado");

-- AddForeignKey
ALTER TABLE "CuentaContable" ADD CONSTRAINT "CuentaContable_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "CuentaContable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaContable" ADD CONSTRAINT "CuentaContable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "Propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
