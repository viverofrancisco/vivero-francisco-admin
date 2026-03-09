-- AlterEnum: Add new roles
ALTER TYPE "UserRole" ADD VALUE 'JARDINERO_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'JARDINERO';

-- CreateTable: Sector
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SectorAdmin
CREATE TABLE "SectorAdmin" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SectorAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Sector.nombre unique
CREATE UNIQUE INDEX "Sector_nombre_key" ON "Sector"("nombre");

-- CreateIndex: SectorAdmin unique
CREATE UNIQUE INDEX "SectorAdmin_sectorId_userId_key" ON "SectorAdmin"("sectorId", "userId");

-- AddForeignKey: SectorAdmin -> Sector
ALTER TABLE "SectorAdmin" ADD CONSTRAINT "SectorAdmin_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SectorAdmin -> User
ALTER TABLE "SectorAdmin" ADD CONSTRAINT "SectorAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add numeroCasa to Cliente
ALTER TABLE "Cliente" ADD COLUMN "numeroCasa" TEXT;

-- AlterTable: Add sectorId to Cliente
ALTER TABLE "Cliente" ADD COLUMN "sectorId" TEXT;

-- Data migration: Create Sector records from existing sector strings
INSERT INTO "Sector" ("id", "nombre", "updatedAt")
SELECT gen_random_uuid(), TRIM(sector), NOW()
FROM "Cliente"
WHERE sector IS NOT NULL AND TRIM(sector) != ''
GROUP BY TRIM(sector);

-- Data migration: Link existing clientes to their sectors
UPDATE "Cliente" c
SET "sectorId" = s."id"
FROM "Sector" s
WHERE TRIM(c.sector) = s."nombre"
AND c.sector IS NOT NULL AND TRIM(c.sector) != '';

-- Drop old sector column
ALTER TABLE "Cliente" DROP COLUMN "sector";

-- AddForeignKey: Cliente -> Sector
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add userId to Jardinero (unique, optional)
ALTER TABLE "Jardinero" ADD COLUMN "userId" TEXT;

-- CreateIndex: Jardinero.userId unique
CREATE UNIQUE INDEX "Jardinero_userId_key" ON "Jardinero"("userId");

-- AddForeignKey: Jardinero -> User
ALTER TABLE "Jardinero" ADD CONSTRAINT "Jardinero_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
