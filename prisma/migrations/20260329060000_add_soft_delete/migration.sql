-- Add deletedAt for soft delete
ALTER TABLE "Cliente" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Servicio" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Personal" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Grupo" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Visita" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Sector" ADD COLUMN "deletedAt" TIMESTAMP(3);
