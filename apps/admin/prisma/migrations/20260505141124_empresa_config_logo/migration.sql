/*
  Warnings:

  - You are about to drop the column `firmante1Cedula` on the `EmpresaConfig` table. All the data in the column will be lost.
  - You are about to drop the column `firmante1Nombre` on the `EmpresaConfig` table. All the data in the column will be lost.
  - You are about to drop the column `firmante2Cedula` on the `EmpresaConfig` table. All the data in the column will be lost.
  - You are about to drop the column `firmante2Nombre` on the `EmpresaConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EmpresaConfig" DROP COLUMN "firmante1Cedula",
DROP COLUMN "firmante1Nombre",
DROP COLUMN "firmante2Cedula",
DROP COLUMN "firmante2Nombre",
ADD COLUMN     "logoKey" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "nombre" TEXT;
