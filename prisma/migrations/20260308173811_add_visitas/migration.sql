-- CreateEnum
CREATE TYPE "EstadoVisita" AS ENUM ('PROGRAMADA', 'COMPLETADA', 'INCOMPLETA', 'REAGENDADA');

-- CreateTable
CREATE TABLE "Visita" (
    "id" TEXT NOT NULL,
    "clienteServicioId" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "fechaRealizada" TIMESTAMP(3),
    "estado" "EstadoVisita" NOT NULL DEFAULT 'PROGRAMADA',
    "grupoId" TEXT,
    "notas" TEXT,
    "notasIncompleto" TEXT,
    "visitaOrigenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Visita_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_clienteServicioId_fkey" FOREIGN KEY ("clienteServicioId") REFERENCES "ClienteServicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoJardinero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_visitaOrigenId_fkey" FOREIGN KEY ("visitaOrigenId") REFERENCES "Visita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
