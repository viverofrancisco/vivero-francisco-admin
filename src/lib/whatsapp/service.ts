import { prisma } from "@/lib/prisma";
import { TipoNotificacion, DestinatarioTipo } from "@/generated/prisma/client";
import { createMetaProvider } from "./meta-provider";
import { formatForWhatsApp, isValidWhatsAppNumber } from "./phone";
import type { SendResult, TemplateComponent } from "./types";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface PlantillaData {
  whatsappTemplateName: string | null;
  whatsappTemplateStatus: string | null;
  whatsappDefaultTemplateName: string | null;
  whatsappDefaultTemplateStatus: string | null;
  whatsappTemplateLanguage: string;
  contenido: string;
  variables: string[];
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function getConfig() {
  return prisma.notificacionConfig.findFirst();
}

async function getPlantilla(tipo: TipoNotificacion) {
  return prisma.notificacionPlantilla.findUnique({ where: { tipo } });
}

function resolverVariables(
  contenido: string,
  vars: Record<string, string>
): string {
  let resultado = contenido;
  for (const [key, value] of Object.entries(vars)) {
    resultado = resultado.replaceAll(`{{${key}}}`, value);
  }
  return resultado;
}

function formatFecha(date: Date): string {
  return date.toLocaleDateString("es-EC", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildTemplateComponents(
  plantilla: PlantillaData,
  vars: Record<string, string>
): TemplateComponent[] {
  // Only include variables that actually appear in the content
  const usedVariables = plantilla.variables.filter((v) =>
    plantilla.contenido.includes(`{{${v}}}`)
  );

  const parameters = usedVariables
    .map((varName) => ({
      type: "text" as const,
      text: vars[varName] || "",
    }));

  if (parameters.length === 0) return [];

  return [
    {
      type: "body" as const,
      parameters,
    },
  ];
}

async function logNotificacion(params: {
  tipo: TipoNotificacion;
  destinatarioTipo: DestinatarioTipo;
  destinatarioId?: string;
  destinatarioNombre?: string;
  telefono: string;
  mensaje: string;
  visitaId?: string;
  result: SendResult;
}) {
  await prisma.notificacionLog.create({
    data: {
      tipo: params.tipo,
      destinatarioTipo: params.destinatarioTipo,
      destinatarioId: params.destinatarioId,
      destinatarioNombre: params.destinatarioNombre,
      telefono: params.telefono,
      mensaje: params.mensaje,
      visitaId: params.visitaId,
      estado: params.result.success ? "ENVIADA" : "FALLIDA",
      whatsappMessageId: params.result.messageId,
      errorDetalle: params.result.error,
      enviadoAt: params.result.success ? new Date() : null,
    },
  });
}

/**
 * Sends a message using an approved Meta template.
 * Tries custom template first, falls back to default.
 */
async function enviarConTemplate(
  telefono: string,
  plantilla: PlantillaData,
  vars: Record<string, string>
): Promise<SendResult> {
  // Determine which template to use: custom (if approved) > default (if approved)
  let templateName: string | null = null;

  if (
    plantilla.whatsappTemplateName &&
    plantilla.whatsappTemplateStatus === "APPROVED"
  ) {
    templateName = plantilla.whatsappTemplateName;
  } else if (
    plantilla.whatsappDefaultTemplateName &&
    plantilla.whatsappDefaultTemplateStatus === "APPROVED"
  ) {
    templateName = plantilla.whatsappDefaultTemplateName;
  }

  if (!templateName) {
    return {
      success: false,
      error: "No hay template aprobado en Meta (ni personalizado ni default).",
    };
  }

  const provider = createMetaProvider();
  if (!provider) {
    return { success: false, error: "WhatsApp provider no configurado" };
  }

  const formatted = formatForWhatsApp(telefono);
  const components = buildTemplateComponents(plantilla, vars);

  return provider.sendTemplate(
    formatted,
    templateName,
    plantilla.whatsappTemplateLanguage,
    components
  );
}

// ──────────────────────────────────────────────
// Funciones publicas
// ──────────────────────────────────────────────

/**
 * Envia confirmacion al cliente cuando se crea una visita.
 */
export async function enviarConfirmacionVisita(visitaId: string) {
  const config = await getConfig();
  if (!config?.whatsappActivo) return;

  const plantilla = await getPlantilla("CONFIRMACION_VISITA_CLIENTE");
  if (!plantilla?.activa) return;

  const visita = await prisma.visita.findUnique({
    where: { id: visitaId },
    include: {
      clienteServicio: {
        include: {
          cliente: true,
          servicio: { select: { nombre: true } },
        },
      },
    },
  });

  if (!visita) return;

  const cliente = visita.clienteServicio.cliente;
  if (!isValidWhatsAppNumber(cliente.telefono)) return;
  if (!cliente.recibirConfirmaciones) return;

  const vars = {
    nombre: cliente.nombre,
    apellido: cliente.apellido || "",
    fechaVisita: formatFecha(visita.fechaProgramada),
    servicio: visita.clienteServicio.servicio.nombre,
    direccion: cliente.direccion || "",
  };

  const mensaje = resolverVariables(plantilla.contenido, vars);
  const result = await enviarConTemplate(cliente.telefono!, plantilla, vars);

  await logNotificacion({
    tipo: "CONFIRMACION_VISITA_CLIENTE",
    destinatarioTipo: "CLIENTE",
    destinatarioId: cliente.id,
    destinatarioNombre: `${vars.nombre} ${vars.apellido}`.trim(),
    telefono: cliente.telefono!,
    mensaje,
    visitaId,
    result,
  });
}

/**
 * Envia recordatorio al cliente 1 dia antes de su visita.
 */
export async function enviarRecordatorioCliente(visitaId: string) {
  const config = await getConfig();
  if (!config?.whatsappActivo) return;

  const plantilla = await getPlantilla("RECORDATORIO_VISITA_CLIENTE");
  if (!plantilla?.activa) return;

  const visita = await prisma.visita.findUnique({
    where: { id: visitaId },
    include: {
      clienteServicio: {
        include: {
          cliente: true,
          servicio: { select: { nombre: true } },
        },
      },
    },
  });

  if (!visita || visita.estado !== "PROGRAMADA") return;

  const cliente = visita.clienteServicio.cliente;
  if (!isValidWhatsAppNumber(cliente.telefono)) return;
  if (!cliente.recibirRecordatorios) return;

  // Check idempotency - don't send if already sent for this visit
  const existing = await prisma.notificacionLog.findFirst({
    where: {
      visitaId,
      tipo: "RECORDATORIO_VISITA_CLIENTE",
      estado: "ENVIADA",
    },
  });
  if (existing) return;

  const vars = {
    nombre: cliente.nombre,
    apellido: cliente.apellido || "",
    fechaVisita: formatFecha(visita.fechaProgramada),
    servicio: visita.clienteServicio.servicio.nombre,
    direccion: cliente.direccion || "",
  };

  const mensaje = resolverVariables(plantilla.contenido, vars);
  const result = await enviarConTemplate(cliente.telefono!, plantilla, vars);

  await logNotificacion({
    tipo: "RECORDATORIO_VISITA_CLIENTE",
    destinatarioTipo: "CLIENTE",
    destinatarioId: cliente.id,
    destinatarioNombre: `${vars.nombre} ${vars.apellido}`.trim(),
    telefono: cliente.telefono!,
    mensaje,
    visitaId,
    result,
  });
}

/**
 * Alerta al admin cuando una visita se completa.
 */
export async function enviarAlertaVisitaCompletada(visitaId: string) {
  const config = await getConfig();
  if (!config?.whatsappActivo) return;

  const plantilla = await getPlantilla("ALERTA_VISITA_COMPLETADA");
  if (!plantilla?.activa) return;

  const visita = await prisma.visita.findUnique({
    where: { id: visitaId },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { nombre: true, apellido: true } },
          servicio: { select: { nombre: true } },
        },
      },
    },
  });

  if (!visita) return;

  const vars = {
    nombre: visita.clienteServicio.cliente.nombre,
    apellido: visita.clienteServicio.cliente.apellido || "",
    fechaVisita: formatFecha(visita.fechaProgramada),
    servicio: visita.clienteServicio.servicio.nombre,
    estado: visita.estado,
    horaEntrada: visita.horaEntrada || "N/A",
    horaSalida: visita.horaSalida || "N/A",
  };

  const mensaje = resolverVariables(plantilla.contenido, vars);

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    include: { personal: { select: { telefono: true } } },
  });

  for (const admin of admins) {
    const telefono = admin.personal?.telefono;
    if (!isValidWhatsAppNumber(telefono)) continue;

    const result = await enviarConTemplate(telefono!, plantilla, vars);

    await logNotificacion({
      tipo: "ALERTA_VISITA_COMPLETADA",
      destinatarioTipo: "ADMIN",
      destinatarioId: admin.id,
      destinatarioNombre: `${admin.name || ""}${admin.apellido ? ` ${admin.apellido}` : ""}`.trim(),
      telefono: telefono!,
      mensaje,
      visitaId,
      result,
    });
  }
}

/**
 * Alerta al admin cuando una visita se marca incompleta o cancelada.
 */
export async function enviarAlertaVisitaIncompleta(visitaId: string) {
  const config = await getConfig();
  if (!config?.whatsappActivo) return;

  const plantilla = await getPlantilla("ALERTA_VISITA_INCOMPLETA");
  if (!plantilla?.activa) return;

  const visita = await prisma.visita.findUnique({
    where: { id: visitaId },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { nombre: true, apellido: true } },
          servicio: { select: { nombre: true } },
        },
      },
    },
  });

  if (!visita) return;

  const vars = {
    nombre: visita.clienteServicio.cliente.nombre,
    apellido: visita.clienteServicio.cliente.apellido || "",
    fechaVisita: formatFecha(visita.fechaProgramada),
    servicio: visita.clienteServicio.servicio.nombre,
    estado: visita.estado,
    motivo: visita.notasIncompleto || "Sin detalle",
  };

  const mensaje = resolverVariables(plantilla.contenido, vars);

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    include: { personal: { select: { telefono: true } } },
  });

  for (const admin of admins) {
    const telefono = admin.personal?.telefono;
    if (!isValidWhatsAppNumber(telefono)) continue;

    const result = await enviarConTemplate(telefono!, plantilla, vars);

    await logNotificacion({
      tipo: "ALERTA_VISITA_INCOMPLETA",
      destinatarioTipo: "ADMIN",
      destinatarioId: admin.id,
      destinatarioNombre: `${admin.name || ""}${admin.apellido ? ` ${admin.apellido}` : ""}`.trim(),
      telefono: telefono!,
      mensaje,
      visitaId,
      result,
    });
  }
}

/**
 * Envia resumen diario de visitas a administradores.
 */
export async function enviarResumenDiarioAdmin() {
  const config = await getConfig();
  if (!config?.whatsappActivo) return;

  const plantilla = await getPlantilla("RESUMEN_DIARIO_ADMIN");
  if (!plantilla?.activa) return;

  // Get today's date in Ecuador timezone
  const now = new Date();
  const ecuadorDate = new Date(
    now.toLocaleString("en-US", { timeZone: config.zonaHoraria })
  );
  const startOfDay = new Date(ecuadorDate.getFullYear(), ecuadorDate.getMonth(), ecuadorDate.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const visitas = await prisma.visita.findMany({
    where: {
      fechaProgramada: { gte: startOfDay, lt: endOfDay },
      estado: "PROGRAMADA",
      deletedAt: null,
    },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { nombre: true, apellido: true, direccion: true } },
          servicio: { select: { nombre: true } },
        },
      },
      grupo: { select: { nombre: true } },
    },
    orderBy: { fechaProgramada: "asc" },
  });

  if (visitas.length === 0) return;

  const listaVisitas = visitas
    .map((v, i) => {
      const c = v.clienteServicio.cliente;
      return `${i + 1}. ${c.nombre}${c.apellido ? ` ${c.apellido}` : ""} - ${v.clienteServicio.servicio.nombre}${c.direccion ? ` (${c.direccion})` : ""}${v.grupo ? ` [${v.grupo.nombre}]` : ""}`;
    })
    .join("\n");

  const vars = {
    fecha: formatFecha(startOfDay),
    totalVisitas: visitas.length.toString(),
    listaVisitas,
  };

  const mensaje = resolverVariables(plantilla.contenido, vars);

  // Check idempotency - only send once per day
  const existing = await prisma.notificacionLog.findFirst({
    where: {
      tipo: "RESUMEN_DIARIO_ADMIN",
      estado: "ENVIADA",
      createdAt: { gte: startOfDay, lt: endOfDay },
    },
  });
  if (existing) return;

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    include: { personal: { select: { telefono: true } } },
  });

  for (const admin of admins) {
    const telefono = admin.personal?.telefono;
    if (!isValidWhatsAppNumber(telefono)) continue;

    const result = await enviarConTemplate(telefono!, plantilla, vars);

    await logNotificacion({
      tipo: "RESUMEN_DIARIO_ADMIN",
      destinatarioTipo: "ADMIN",
      destinatarioId: admin.id,
      destinatarioNombre: `${admin.name || ""}${admin.apellido ? ` ${admin.apellido}` : ""}`.trim(),
      telefono: telefono!,
      mensaje,
      result,
    });
  }
}

/**
 * Envia código OTP al cliente vía WhatsApp.
 * Usa el template AUTENTICACION_OTP (categoría Authentication de Meta) con
 * botón Copy Code. Meta exige que el código se pase tanto en el body como en
 * el componente button.
 */
export async function enviarOtpWhatsApp(
  telefono: string,
  codigo: string,
  clienteId?: string
): Promise<SendResult> {
  const plantilla = await getPlantilla("AUTENTICACION_OTP");
  if (!plantilla?.activa) {
    return { success: false, error: "Plantilla de OTP no activa" };
  }

  if (!isValidWhatsAppNumber(telefono)) {
    return { success: false, error: "Número de teléfono inválido" };
  }

  const templateName =
    plantilla.whatsappTemplateStatus === "APPROVED"
      ? plantilla.whatsappTemplateName
      : plantilla.whatsappDefaultTemplateStatus === "APPROVED"
        ? plantilla.whatsappDefaultTemplateName
        : null;

  if (!templateName) {
    const result: SendResult = {
      success: false,
      error: "Template de OTP no aprobado en Meta",
    };
    await logNotificacion({
      tipo: "AUTENTICACION_OTP",
      destinatarioTipo: "CLIENTE",
      destinatarioId: clienteId,
      telefono,
      mensaje: `OTP: ${codigo}`,
      result,
    });
    return result;
  }

  const provider = createMetaProvider();
  if (!provider) {
    return { success: false, error: "WhatsApp provider no configurado" };
  }

  const formatted = formatForWhatsApp(telefono);
  const components: TemplateComponent[] = [
    {
      type: "body",
      parameters: [{ type: "text", text: codigo }],
    },
    {
      type: "button",
      sub_type: "copy_code",
      index: "0",
      parameters: [{ type: "text", text: codigo }],
    },
  ];

  const result = await provider.sendTemplate(
    formatted,
    templateName,
    plantilla.whatsappTemplateLanguage,
    components
  );

  const mensaje = resolverVariables(plantilla.contenido, { codigo });

  await logNotificacion({
    tipo: "AUTENTICACION_OTP",
    destinatarioTipo: "CLIENTE",
    destinatarioId: clienteId,
    telefono,
    mensaje,
    result,
  });

  return result;
}

/**
 * Processes an incoming WhatsApp message from a client.
 * Executes auto-reply and/or forward based on config.
 */
export async function procesarMensajeEntrante(data: {
  telefono: string;
  mensaje: string;
  nombre: string;
}) {
  const config = await getConfig();
  if (!config?.whatsappActivo) return;

  // Try to match an existing client by phone number to personalize
  let clienteNombre = data.nombre;
  try {
    const formattedIncoming = formatForWhatsApp(data.telefono);
    const clientes = await prisma.cliente.findMany({
      where: { deletedAt: null, telefono: { not: null } },
      select: { nombre: true, apellido: true, telefono: true },
    });
    const match = clientes.find(
      (c) => c.telefono && formatForWhatsApp(c.telefono) === formattedIncoming
    );
    if (match) {
      clienteNombre = `${match.nombre}${match.apellido ? ` ${match.apellido}` : ""}`;
    }
  } catch {
    // ignore, use profile name
  }

  // ── 1. Auto-reply al cliente (texto libre, dentro de ventana 24h)
  if (
    config.autoRespuestaActiva &&
    config.autoRespuestaContenido &&
    isValidWhatsAppNumber(data.telefono)
  ) {
    const mensajeReply = resolverVariables(config.autoRespuestaContenido, {
      nombre: clienteNombre,
    });

    const provider = createMetaProvider();
    if (provider) {
      const result = await provider.sendText(
        formatForWhatsApp(data.telefono),
        mensajeReply
      );

      await logNotificacion({
        tipo: "MENSAJE_ENTRANTE_CLIENTE",
        destinatarioTipo: "CLIENTE",
        destinatarioNombre: clienteNombre,
        telefono: data.telefono,
        mensaje: mensajeReply,
        result,
      });
    }
  }

  // ── 2. Forward al admin (via template)
  if (
    config.forwardActivo &&
    config.forwardTelefono &&
    isValidWhatsAppNumber(config.forwardTelefono)
  ) {
    const plantilla = await getPlantilla("MENSAJE_ENTRANTE_CLIENTE");
    if (plantilla?.activa) {
      const vars = {
        nombre: clienteNombre,
        telefono: data.telefono,
        mensaje: data.mensaje,
      };

      const mensajeFwd = resolverVariables(plantilla.contenido, vars);
      const result = await enviarConTemplate(
        config.forwardTelefono,
        plantilla,
        vars
      );

      await logNotificacion({
        tipo: "MENSAJE_ENTRANTE_CLIENTE",
        destinatarioTipo: "ADMIN",
        destinatarioNombre: "Forward a admin",
        telefono: config.forwardTelefono,
        mensaje: mensajeFwd,
        result,
      });
    }
  }
}
