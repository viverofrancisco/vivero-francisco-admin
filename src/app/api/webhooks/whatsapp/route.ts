import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { procesarMensajeEntrante } from "@/lib/whatsapp/service";

/**
 * GET - Webhook verification (Meta sends a challenge when configuring)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * POST - Receive webhook events from Meta
 */
export async function POST(request: Request) {
  const body = await request.json();

  // Process template status updates and incoming messages
  const entries = body?.entry || [];
  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      if (change?.field === "message_template_status_update") {
        const { event, message_template_name, reason } = change.value || {};

        if (!message_template_name || !event) continue;

        await handleTemplateStatusUpdate(
          message_template_name,
          event.toUpperCase(),
          reason
        );
      } else if (change?.field === "messages") {
        const value = change.value || {};
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const msg of messages) {
          // Only process text messages for now
          if (msg.type !== "text") continue;

          const telefono = msg.from;
          const contenido = msg.text?.body;
          if (!telefono || !contenido) continue;

          // Find matching contact for sender name
          const contact = contacts.find(
            (c: { wa_id?: string }) => c.wa_id === telefono
          );
          const nombre = contact?.profile?.name || "Cliente";

          // Fire-and-forget to respond quickly to Meta
          procesarMensajeEntrante({
            telefono,
            mensaje: contenido,
            nombre,
          }).catch(console.error);
        }
      }
    }
  }

  // Meta requires 200 response quickly
  return NextResponse.json({ success: true });
}

async function handleTemplateStatusUpdate(
  templateName: string,
  status: string,
  reason?: string
) {
  // Check if it's a default template
  const defaultMatch = await prisma.notificacionPlantilla.findFirst({
    where: { whatsappDefaultTemplateName: templateName },
  });

  if (defaultMatch) {
    await prisma.notificacionPlantilla.update({
      where: { id: defaultMatch.id },
      data: { whatsappDefaultTemplateStatus: status },
    });
    return;
  }

  // Check if it's a custom active template (first-edit pending or approved)
  const activeMatch = await prisma.notificacionPlantilla.findFirst({
    where: { whatsappTemplateName: templateName },
  });

  if (activeMatch) {
    if (status === "APPROVED" && activeMatch.contenidoEnRevision) {
      // First-edit template got approved: promote contenidoEnRevision → contenido
      await prisma.notificacionPlantilla.update({
        where: { id: activeMatch.id },
        data: {
          whatsappTemplateStatus: "APPROVED",
          contenido: activeMatch.contenidoEnRevision,
          contenidoEnRevision: null,
        },
      });
    } else if (status === "REJECTED") {
      // First-edit rejected: clear contenidoEnRevision
      await prisma.notificacionPlantilla.update({
        where: { id: activeMatch.id },
        data: {
          whatsappTemplateStatus: status,
          contenidoEnRevision: null,
        },
      });
    } else {
      await prisma.notificacionPlantilla.update({
        where: { id: activeMatch.id },
        data: { whatsappTemplateStatus: status },
      });
    }
    return;
  }

  // Check if it's a pending template (update of existing approved custom)
  const pendingMatch = await prisma.notificacionPlantilla.findFirst({
    where: { whatsappPendingTemplateName: templateName },
  });

  if (pendingMatch) {
    if (status === "APPROVED") {
      // Promote pending to active, delete old custom, promote contenidoEnRevision
      const oldCustomName = pendingMatch.whatsappTemplateName;

      await prisma.notificacionPlantilla.update({
        where: { id: pendingMatch.id },
        data: {
          whatsappTemplateName: pendingMatch.whatsappPendingTemplateName,
          whatsappTemplateStatus: "APPROVED",
          whatsappPendingTemplateName: null,
          whatsappPendingTemplateStatus: null,
          contenido: pendingMatch.contenidoEnRevision ?? pendingMatch.contenido,
          contenidoEnRevision: null,
        },
      });

      // Delete old custom template from Meta if it existed
      if (oldCustomName) {
        const businessId = process.env.WHATSAPP_BUSINESS_ID;
        const token = process.env.WHATSAPP_API_TOKEN;
        if (businessId && token) {
          await fetch(
            `https://graph.facebook.com/v21.0/${businessId}/message_templates?name=${encodeURIComponent(oldCustomName)}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            }
          ).catch(console.error);
        }
      }
    } else if (status === "REJECTED") {
      // Clean up rejected pending
      const businessId = process.env.WHATSAPP_BUSINESS_ID;
      const token = process.env.WHATSAPP_API_TOKEN;

      await prisma.notificacionPlantilla.update({
        where: { id: pendingMatch.id },
        data: {
          whatsappPendingTemplateName: null,
          whatsappPendingTemplateStatus: null,
          contenidoEnRevision: null,
        },
      });

      // Delete rejected template from Meta
      if (businessId && token) {
        await fetch(
          `https://graph.facebook.com/v21.0/${businessId}/message_templates?name=${encodeURIComponent(templateName)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        ).catch(console.error);
      }
    } else {
      await prisma.notificacionPlantilla.update({
        where: { id: pendingMatch.id },
        data: { whatsappPendingTemplateStatus: status },
      });
    }
  }
}
