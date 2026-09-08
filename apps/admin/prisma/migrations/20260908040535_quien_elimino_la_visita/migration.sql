-- AlterTable
ALTER TABLE "Visita" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "deletedByNombre" TEXT;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
