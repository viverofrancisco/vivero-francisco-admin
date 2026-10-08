-- AlterTable
ALTER TABLE "SolicitudCliente" ADD COLUMN     "contactoEmail" TEXT,
ADD COLUMN     "contactoNombre" TEXT,
ADD COLUMN     "contactoTelefono" TEXT,
ALTER COLUMN "clienteId" DROP NOT NULL;
