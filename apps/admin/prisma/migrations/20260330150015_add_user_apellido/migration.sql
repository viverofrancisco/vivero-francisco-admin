-- AlterTable
ALTER TABLE "User" ADD COLUMN     "apellido" TEXT;

-- RenameForeignKey
ALTER TABLE "Grupo" RENAME CONSTRAINT "GrupoJardinero_createdById_fkey" TO "Grupo_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "Grupo" RENAME CONSTRAINT "GrupoJardinero_updatedById_fkey" TO "Grupo_updatedById_fkey";

-- RenameForeignKey
ALTER TABLE "GrupoMiembro" RENAME CONSTRAINT "GrupoJardineroMiembro_grupoId_fkey" TO "GrupoMiembro_grupoId_fkey";

-- RenameForeignKey
ALTER TABLE "GrupoMiembro" RENAME CONSTRAINT "GrupoJardineroMiembro_jardineroId_fkey" TO "GrupoMiembro_personalId_fkey";

-- RenameForeignKey
ALTER TABLE "Personal" RENAME CONSTRAINT "Jardinero_createdById_fkey" TO "Personal_createdById_fkey";

-- RenameForeignKey
ALTER TABLE "Personal" RENAME CONSTRAINT "Jardinero_updatedById_fkey" TO "Personal_updatedById_fkey";

-- RenameForeignKey
ALTER TABLE "Personal" RENAME CONSTRAINT "Jardinero_userId_fkey" TO "Personal_userId_fkey";
