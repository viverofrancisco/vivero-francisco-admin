-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "recibirConfirmaciones" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "recibirRecordatorios" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "NotificacionPlantilla" ADD COLUMN     "whatsappPendingTemplateName" TEXT,
ADD COLUMN     "whatsappPendingTemplateStatus" TEXT,
ADD COLUMN     "whatsappTemplateStatus" TEXT,
ADD COLUMN     "whatsappTemplateVersion" INTEGER NOT NULL DEFAULT 1;
