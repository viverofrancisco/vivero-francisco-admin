-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('NATURAL', 'JURIDICA');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "cedula" TEXT,
ADD COLUMN     "ruc" TEXT,
ADD COLUMN     "tipoPersona" "TipoPersona";

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "contificoProductoId" TEXT,
ADD COLUMN     "ivaTasa" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "VisitaServicio" ADD COLUMN     "ivaTasa" DECIMAL(5,2),
ADD COLUMN     "precio" DECIMAL(10,2);
