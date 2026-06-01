-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('RECORDATORIO_VISITA_CLIENTE', 'CONFIRMACION_VISITA_CLIENTE', 'RESUMEN_DIARIO_ADMIN', 'ALERTA_VISITA_COMPLETADA', 'ALERTA_VISITA_INCOMPLETA');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA');

-- CreateEnum
CREATE TYPE "DestinatarioTipo" AS ENUM ('CLIENTE', 'ADMIN', 'PERSONAL');

-- CreateTable
CREATE TABLE "NotificacionConfig" (
    "id" TEXT NOT NULL,
    "whatsappActivo" BOOLEAN NOT NULL DEFAULT false,
    "whatsappPhoneNumberId" TEXT,
    "whatsappBusinessId" TEXT,
    "horaEnvioRecordatorio" TEXT NOT NULL DEFAULT '08:00',
    "horaEnvioDigesto" TEXT NOT NULL DEFAULT '07:00',
    "diasAnticipacion" INTEGER NOT NULL DEFAULT 1,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificacionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionPlantilla" (
    "id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "whatsappTemplateName" TEXT,
    "whatsappTemplateLanguage" TEXT NOT NULL DEFAULT 'es',
    "contenido" TEXT NOT NULL,
    "variables" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificacionPlantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionLog" (
    "id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "destinatarioTipo" "DestinatarioTipo" NOT NULL,
    "destinatarioId" TEXT,
    "destinatarioNombre" TEXT,
    "telefono" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'PENDIENTE',
    "whatsappMessageId" TEXT,
    "errorDetalle" TEXT,
    "visitaId" TEXT,
    "enviadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionPlantilla_tipo_key" ON "NotificacionPlantilla"("tipo");

-- AddForeignKey
ALTER TABLE "NotificacionLog" ADD CONSTRAINT "NotificacionLog_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
