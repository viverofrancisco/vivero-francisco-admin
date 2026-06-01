/*
  Warnings:

  - The values [REAGENDADA] on the enum `EstadoVisita` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `visitaOrigenId` on the `Visita` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoVisita_new" AS ENUM ('PROGRAMADA', 'COMPLETADA', 'INCOMPLETA', 'CANCELADA');
ALTER TABLE "public"."Visita" ALTER COLUMN "estado" DROP DEFAULT;
-- Convert REAGENDADA to CANCELADA via text cast
ALTER TABLE "Visita" ALTER COLUMN "estado" TYPE TEXT;
UPDATE "Visita" SET "estado" = 'CANCELADA' WHERE "estado" = 'REAGENDADA';
ALTER TABLE "Visita" ALTER COLUMN "estado" TYPE "EstadoVisita_new" USING ("estado"::"EstadoVisita_new");
ALTER TYPE "EstadoVisita" RENAME TO "EstadoVisita_old";
ALTER TYPE "EstadoVisita_new" RENAME TO "EstadoVisita";
DROP TYPE "public"."EstadoVisita_old";
ALTER TABLE "Visita" ALTER COLUMN "estado" SET DEFAULT 'PROGRAMADA';
COMMIT;

-- DropForeignKey
ALTER TABLE "Visita" DROP CONSTRAINT IF EXISTS "Visita_visitaOrigenId_fkey";

-- AlterTable
ALTER TABLE "Visita" DROP COLUMN IF EXISTS "visitaOrigenId";

-- CreateTable
CREATE TABLE "VisitaMedia" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitaMedia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VisitaMedia" ADD CONSTRAINT "VisitaMedia_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
