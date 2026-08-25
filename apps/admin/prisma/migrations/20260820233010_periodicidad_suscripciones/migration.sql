-- CreateEnum
CREATE TYPE "Periodicidad" AS ENUM ('MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "periodicidad" "Periodicidad";

-- Todo lo recurrente que existe hoy se cobra por mes.
UPDATE "Producto" SET "periodicidad" = 'MENSUAL' WHERE "modalidad" = 'SUSCRIPCION';
