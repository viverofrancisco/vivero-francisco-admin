import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createMetaProvider } from "@/lib/whatsapp/meta-provider";

/**
 * POST - Cancel a pending template review.
 *
 * Handles two cases:
 * - whatsappPendingTemplateName exists (update of an existing approved custom):
 *   delete just the pending one from Meta, clear pending fields
 * - whatsappTemplateName exists with PENDING status (first-time edit before approval):
 *   delete the whole custom template from Meta, clear whatsappTemplate fields
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const plantilla = await prisma.notificacionPlantilla.findUnique({
    where: { id },
  });

  if (!plantilla) {
    return NextResponse.json(
      { error: "Plantilla no encontrada" },
      { status: 404 }
    );
  }

  const businessId = process.env.WHATSAPP_BUSINESS_ID;
  if (!businessId) {
    return NextResponse.json(
      { error: "WHATSAPP_BUSINESS_ID no configurado" },
      { status: 400 }
    );
  }

  const provider = createMetaProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "WhatsApp provider no configurado" },
      { status: 400 }
    );
  }

  // Case 1: pending template exists (update of existing custom)
  if (plantilla.whatsappPendingTemplateName) {
    await provider
      .deleteTemplate(businessId, plantilla.whatsappPendingTemplateName)
      .catch(console.error);

    const updated = await prisma.notificacionPlantilla.update({
      where: { id },
      data: {
        whatsappPendingTemplateName: null,
        whatsappPendingTemplateStatus: null,
        contenidoEnRevision: null,
      },
    });

    return NextResponse.json(updated);
  }

  // Case 2: custom template is PENDING (first edit before approval)
  if (
    plantilla.whatsappTemplateName &&
    plantilla.whatsappTemplateStatus !== "APPROVED"
  ) {
    await provider
      .deleteTemplate(businessId, plantilla.whatsappTemplateName)
      .catch(console.error);

    const updated = await prisma.notificacionPlantilla.update({
      where: { id },
      data: {
        whatsappTemplateName: null,
        whatsappTemplateStatus: null,
        contenidoEnRevision: null,
      },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json(
    { error: "No hay template en revisión para cancelar" },
    { status: 400 }
  );
}
