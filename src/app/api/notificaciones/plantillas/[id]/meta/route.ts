import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createMetaProvider } from "@/lib/whatsapp/meta-provider";

function getBusinessId(): string | null {
  return process.env.WHATSAPP_BUSINESS_ID || null;
}

/**
 * Converts named variables ({{clienteNombre}}) to positional ({{1}}, {{2}}, ...)
 * following the order defined in the plantilla's `variables` array.
 */
function convertToPositionalVariables(
  contenido: string,
  variables: string[]
): string {
  let result = contenido;
  variables.forEach((varName, index) => {
    result = result.replaceAll(`{{${varName}}}`, `{{${index + 1}}}`);
  });
  return result;
}

function generateTemplateName(tipo: string, version: number): string {
  return `${tipo.toLowerCase()}_custom_v${version}`;
}

/**
 * POST - Create or update a template in Meta
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

  // Accept optional contenido override in body (for transactional save)
  let overrideContenido: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.contenido === "string") {
      overrideContenido = body.contenido;
    }
  } catch {
    // no body, use DB content
  }

  const plantilla = await prisma.notificacionPlantilla.findUnique({
    where: { id },
  });

  if (!plantilla) {
    return NextResponse.json(
      { error: "Plantilla no encontrada" },
      { status: 404 }
    );
  }

  const businessId = getBusinessId();
  if (!businessId) {
    return NextResponse.json(
      { error: "Variable de entorno WHATSAPP_BUSINESS_ID no configurada" },
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

  // Use override content if provided, otherwise DB content
  const contenido = overrideContenido ?? plantilla.contenido;

  // Only include variables that actually appear in the content
  const usedVariables = plantilla.variables.filter((v) =>
    contenido.includes(`{{${v}}}`)
  );

  const bodyText = convertToPositionalVariables(
    contenido,
    usedVariables
  );

  // Generate example values for Meta (required when template has variables)
  const SAMPLE_VALUES: Record<string, string> = {
    nombre: "Juan",
    apellido: "Pérez",
    fechaVisita: "lunes, 7 de abril de 2025",
    servicio: "Mantenimiento de jardín",
    direccion: "Av. Principal 123",
    fecha: "lunes, 7 de abril de 2025",
    totalVisitas: "5",
    listaVisitas: "1. Juan - Mantenimiento",
    estado: "COMPLETADA",
    horaEntrada: "09:00",
    horaSalida: "11:30",
    motivo: "Cliente no disponible",
  };

  const exampleValues = usedVariables.map(
    (v) => SAMPLE_VALUES[v] || v
  );

  // First time creating a template
  if (!plantilla.whatsappTemplateName) {
    const templateName = generateTemplateName(
      plantilla.tipo,
      plantilla.whatsappTemplateVersion
    );

    const result = await provider.createTemplate(
      businessId,
      templateName,
      plantilla.whatsappTemplateLanguage,
      bodyText,
      exampleValues
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Error al crear template en Meta" },
        { status: 400 }
      );
    }

    const updated = await prisma.notificacionPlantilla.update({
      where: { id },
      data: {
        whatsappTemplateName: templateName,
        whatsappTemplateStatus: result.status || "PENDING",
      },
    });

    return NextResponse.json(updated);
  }

  // If there's an existing pending template, delete it first
  if (plantilla.whatsappPendingTemplateName) {
    await provider
      .deleteTemplate(businessId, plantilla.whatsappPendingTemplateName)
      .catch(console.error);
  }

  // Create new version as pending
  const newVersion = plantilla.whatsappTemplateVersion + 1;
  const pendingName = generateTemplateName(plantilla.tipo, newVersion);

  const result = await provider.createTemplate(
    businessId,
    pendingName,
    plantilla.whatsappTemplateLanguage,
    bodyText,
    exampleValues
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Error al crear template en Meta" },
      { status: 400 }
    );
  }

  const updated = await prisma.notificacionPlantilla.update({
    where: { id },
    data: {
      whatsappPendingTemplateName: pendingName,
      whatsappPendingTemplateStatus: result.status || "PENDING",
      whatsappTemplateVersion: newVersion,
    },
  });

  return NextResponse.json(updated);
}

/**
 * GET - Check template status(es) in Meta and handle version promotion
 */
export async function GET(
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

  const businessId = getBusinessId();
  if (!businessId) {
    return NextResponse.json(
      { error: "Variable de entorno WHATSAPP_BUSINESS_ID no configurada" },
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {};

  // Check active template status
  if (plantilla.whatsappTemplateName) {
    const result = await provider.getTemplateStatus(
      businessId,
      plantilla.whatsappTemplateName
    );
    if (result.success && result.status) {
      updateData.whatsappTemplateStatus = result.status;
    }
  }

  // Check pending template status
  if (plantilla.whatsappPendingTemplateName) {
    const result = await provider.getTemplateStatus(
      businessId,
      plantilla.whatsappPendingTemplateName
    );

    if (result.success && result.status) {
      if (result.status === "APPROVED") {
        // Pending approved: promote to active, delete old
        const oldTemplateName = plantilla.whatsappTemplateName;

        updateData.whatsappTemplateName =
          plantilla.whatsappPendingTemplateName;
        updateData.whatsappTemplateStatus = "APPROVED";
        updateData.whatsappPendingTemplateName = null;
        updateData.whatsappPendingTemplateStatus = null;

        // Delete old template from Meta
        if (oldTemplateName) {
          await provider
            .deleteTemplate(businessId, oldTemplateName)
            .catch(console.error);
        }
      } else if (result.status === "REJECTED") {
        // Pending rejected: clean up, keep active
        updateData.whatsappPendingTemplateName = null;
        updateData.whatsappPendingTemplateStatus = null;

        // Delete rejected template from Meta
        await provider
          .deleteTemplate(businessId, plantilla.whatsappPendingTemplateName)
          .catch(console.error);
      } else {
        updateData.whatsappPendingTemplateStatus = result.status;
      }
    }
  }

  const updated =
    Object.keys(updateData).length > 0
      ? await prisma.notificacionPlantilla.update({
          where: { id },
          data: updateData,
        })
      : plantilla;

  return NextResponse.json(updated);
}

/**
 * DELETE - Remove template(s) from Meta
 */
export async function DELETE(
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

  const businessId = getBusinessId();
  if (!businessId) {
    return NextResponse.json(
      { error: "Variable de entorno WHATSAPP_BUSINESS_ID no configurada" },
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

  // Delete active template
  if (plantilla.whatsappTemplateName) {
    await provider
      .deleteTemplate(businessId, plantilla.whatsappTemplateName)
      .catch(console.error);
  }

  // Delete pending template
  if (plantilla.whatsappPendingTemplateName) {
    await provider
      .deleteTemplate(businessId, plantilla.whatsappPendingTemplateName)
      .catch(console.error);
  }

  const updated = await prisma.notificacionPlantilla.update({
    where: { id },
    data: {
      whatsappTemplateName: null,
      whatsappTemplateStatus: null,
      whatsappPendingTemplateName: null,
      whatsappPendingTemplateStatus: null,
    },
  });

  return NextResponse.json(updated);
}
