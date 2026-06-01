-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'MENSAJE_ENTRANTE_CLIENTE';

-- AlterTable
ALTER TABLE "NotificacionConfig" ADD COLUMN     "autoRespuestaActiva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoRespuestaContenido" TEXT,
ADD COLUMN     "forwardActivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forwardTelefono" TEXT;
