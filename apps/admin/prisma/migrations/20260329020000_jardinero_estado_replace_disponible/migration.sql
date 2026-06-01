-- AlterTable: Add estado column, migrate data from disponible, drop disponible
ALTER TABLE "Jardinero" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'ACTIVO';

-- Migrate existing data
UPDATE "Jardinero" SET "estado" = CASE WHEN "disponible" = true THEN 'ACTIVO' ELSE 'INACTIVO' END;

-- Drop old column
ALTER TABLE "Jardinero" DROP COLUMN "disponible";
