import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createMetaProvider } from "@/lib/whatsapp/meta-provider";
import { formatForWhatsApp } from "@/lib/whatsapp/phone";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const telefono = body.telefono;

  if (!telefono) {
    return NextResponse.json(
      { error: "Teléfono es obligatorio" },
      { status: 400 }
    );
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

  // Determine which template to use: approved custom > approved default
  let templateName: string | null = null;
  let contenidoToUse: string = plantilla.contenido;

  if (
    plantilla.whatsappTemplateName &&
    plantilla.whatsappTemplateStatus === "APPROVED"
  ) {
    templateName = plantilla.whatsappTemplateName;
    contenidoToUse = plantilla.contenido;
  } else if (
    plantilla.whatsappDefaultTemplateName &&
    plantilla.whatsappDefaultTemplateStatus === "APPROVED"
  ) {
    templateName = plantilla.whatsappDefaultTemplateName;
    contenidoToUse = plantilla.contenidoOriginal || plantilla.contenido;
  }

  if (!templateName) {
    return NextResponse.json(
      {
        error:
          "No hay ningún template aprobado en Meta. Espera a que WhatsApp apruebe el template antes de enviar una prueba.",
      },
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

  // Build sample parameters for testing
  const sampleValues: Record<string, string> = {
    nombre: "Juan",
    apellido: "Pérez",
    fechaVisita: "lunes, 7 de abril de 2025",
    servicio: "Mantenimiento de jardín",
    direccion: "Av. Principal 123",
    fecha: "lunes, 7 de abril de 2025",
    totalVisitas: "5",
    listaVisitas: "1. Juan Pérez - Mantenimiento\n2. María López - Poda",
    estado: "COMPLETADA",
    horaEntrada: "09:00",
    horaSalida: "11:30",
    motivo: "Cliente no disponible",
  };

  // Only include variables that actually appear in the content being tested
  const usedVariables = plantilla.variables.filter((v) =>
    contenidoToUse.includes(`{{${v}}}`)
  );

  const parameters = usedVariables.map((varName) => ({
    type: "text" as const,
    text: sampleValues[varName] || varName,
  }));

  const components =
    parameters.length > 0
      ? [{ type: "body" as const, parameters }]
      : [];

  const formatted = formatForWhatsApp(telefono);
  const result = await provider.sendTemplate(
    formatted,
    templateName,
    plantilla.whatsappTemplateLanguage,
    components
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Error al enviar mensaje de prueba" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
  });
}
