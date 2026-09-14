-- CreateEnum
CREATE TYPE "OrdenTareas" AS ENUM ('PERSONALIZADO', 'ALFABETICO_AZ', 'ALFABETICO_ZA');

-- AlterTable
ALTER TABLE "EmpresaConfig" ADD COLUMN     "tareasOrden" "OrdenTareas" NOT NULL DEFAULT 'PERSONALIZADO';
