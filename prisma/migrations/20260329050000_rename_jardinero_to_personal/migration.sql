-- Rename UserRole enum values
ALTER TYPE "UserRole" RENAME VALUE 'JARDINERO' TO 'PERSONAL';
ALTER TYPE "UserRole" RENAME VALUE 'JARDINERO_ADMIN' TO 'PERSONAL_ADMIN';

-- Rename tables
ALTER TABLE "Jardinero" RENAME TO "Personal";
ALTER TABLE "GrupoJardinero" RENAME TO "Grupo";
ALTER TABLE "GrupoJardineroMiembro" RENAME TO "GrupoMiembro";

-- Add tipo field to Personal
ALTER TABLE "Personal" ADD COLUMN "tipo" TEXT;

-- Rename column in GrupoMiembro
ALTER TABLE "GrupoMiembro" RENAME COLUMN "jardineroId" TO "personalId";

-- Rename indexes and constraints for Personal (formerly Jardinero)
ALTER INDEX "Jardinero_pkey" RENAME TO "Personal_pkey";
ALTER INDEX "Jardinero_userId_key" RENAME TO "Personal_userId_key";

-- Rename indexes and constraints for Grupo (formerly GrupoJardinero)
ALTER INDEX "GrupoJardinero_pkey" RENAME TO "Grupo_pkey";

-- Rename indexes and constraints for GrupoMiembro (formerly GrupoJardineroMiembro)
ALTER INDEX "GrupoJardineroMiembro_pkey" RENAME TO "GrupoMiembro_pkey";
ALTER INDEX "GrupoJardineroMiembro_jardineroId_grupoId_key" RENAME TO "GrupoMiembro_personalId_grupoId_key";
