import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { NotificacionDetail } from "@/components/configuracion/notificacion-detail";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { createMetaProvider } from "@/lib/whatsapp/meta-provider";

const TIPOS_CLIENTE = [
  "CONFIRMACION_VISITA_CLIENTE",
  "RECORDATORIO_VISITA_CLIENTE",
];

/**
 * Fallback: verify pending template status on page load
 * in case the webhook didn't fire.
 */
async function verifyPendingStatus(plantillaId: string) {
  const plantilla = await prisma.notificacionPlantilla.findUnique({
    where: { id: plantillaId },
  });

  if (!plantilla) return;

  const businessId = process.env.WHATSAPP_BUSINESS_ID;
  if (!businessId) return;

  const provider = createMetaProvider();
  if (!provider) return;

  // Check default template status if pending
  if (
    plantilla.whatsappDefaultTemplateName &&
    plantilla.whatsappDefaultTemplateStatus !== "APPROVED"
  ) {
    const result = await provider.getTemplateStatus(
      businessId,
      plantilla.whatsappDefaultTemplateName
    );
    if (result.success && result.status) {
      await prisma.notificacionPlantilla.update({
        where: { id: plantillaId },
        data: { whatsappDefaultTemplateStatus: result.status },
      });
    }
  }

  // Check custom template status if pending (first-edit case)
  if (
    plantilla.whatsappTemplateName &&
    plantilla.whatsappTemplateStatus !== "APPROVED" &&
    !plantilla.whatsappPendingTemplateName
  ) {
    const result = await provider.getTemplateStatus(
      businessId,
      plantilla.whatsappTemplateName
    );
    if (result.success && result.status) {
      if (result.status === "APPROVED" && plantilla.contenidoEnRevision) {
        await prisma.notificacionPlantilla.update({
          where: { id: plantillaId },
          data: {
            whatsappTemplateStatus: "APPROVED",
            contenido: plantilla.contenidoEnRevision,
            contenidoEnRevision: null,
          },
        });
      } else if (result.status === "REJECTED") {
        await prisma.notificacionPlantilla.update({
          where: { id: plantillaId },
          data: {
            whatsappTemplateStatus: "REJECTED",
            contenidoEnRevision: null,
          },
        });
      } else {
        await prisma.notificacionPlantilla.update({
          where: { id: plantillaId },
          data: { whatsappTemplateStatus: result.status },
        });
      }
    }
  }

  // Check pending custom template status
  if (plantilla.whatsappPendingTemplateName) {
    const result = await provider.getTemplateStatus(
      businessId,
      plantilla.whatsappPendingTemplateName
    );

    if (result.success && result.status) {
      if (result.status === "APPROVED") {
        const oldCustom = plantilla.whatsappTemplateName;
        await prisma.notificacionPlantilla.update({
          where: { id: plantillaId },
          data: {
            whatsappTemplateName: plantilla.whatsappPendingTemplateName,
            whatsappTemplateStatus: "APPROVED",
            whatsappPendingTemplateName: null,
            whatsappPendingTemplateStatus: null,
            contenido: plantilla.contenidoEnRevision ?? plantilla.contenido,
            contenidoEnRevision: null,
          },
        });
        if (oldCustom) {
          await provider
            .deleteTemplate(businessId, oldCustom)
            .catch(console.error);
        }
      } else if (result.status === "REJECTED") {
        await prisma.notificacionPlantilla.update({
          where: { id: plantillaId },
          data: {
            whatsappPendingTemplateName: null,
            whatsappPendingTemplateStatus: null,
            contenidoEnRevision: null,
          },
        });
        await provider
          .deleteTemplate(
            businessId,
            plantilla.whatsappPendingTemplateName
          )
          .catch(console.error);
      } else {
        await prisma.notificacionPlantilla.update({
          where: { id: plantillaId },
          data: { whatsappPendingTemplateStatus: result.status },
        });
      }
    }
  }
}

export default async function NotificacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  // Verify pending statuses as fallback
  await verifyPendingStatus(id).catch(console.error);

  // Re-fetch after potential status updates
  const [plantilla, notificacionConfig] = await Promise.all([
    prisma.notificacionPlantilla.findUnique({ where: { id } }),
    prisma.notificacionConfig.findFirst(),
  ]);

  if (!plantilla) {
    notFound();
  }

  const isCliente = TIPOS_CLIENTE.includes(plantilla.tipo);
  const backHref = `/dashboard/configuracion/notificaciones/${isCliente ? "clientes" : "admin"}`;
  const backLabel = isCliente
    ? "Notificaciones para Clientes"
    : "Notificaciones para Administradores";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <p className="text-sm text-muted-foreground">{backLabel}</p>
          <h1 className="text-2xl font-bold">{plantilla.nombre}</h1>
        </div>
      </div>

      <NotificacionDetail
        plantilla={plantilla}
        scheduleConfig={
          notificacionConfig
            ? {
                horaEnvioRecordatorio: notificacionConfig.horaEnvioRecordatorio,
                horaEnvioDigesto: notificacionConfig.horaEnvioDigesto,
                diasAnticipacion: notificacionConfig.diasAnticipacion,
              }
            : undefined
        }
      />
    </div>
  );
}
