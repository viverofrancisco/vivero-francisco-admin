import { prisma } from "@/lib/prisma";
import { nombreCliente } from "@vivero/shared";
import { listaTareas } from "@/lib/visita-tareas";
import { sendPushToUser, sendPushToUsers } from "./expo";

function formatFechaCorta(date: Date): string {
  return date.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

async function getVisitaForPush(visitaId: string) {
  return prisma.visita.findUnique({
    where: { id: visitaId },
    include: {
      cliente: {
        select: { userId: true, nombre: true, apellido: true, empresa: true },
      },
      // Lo hecho sale de lo que cargó cada jardinero, más lo que se exigía:
      // una visita recién confirmada todavía no tiene nada hecho, y ahí lo que
      // se anuncia son las tareas que se pidieron.
      tareasObligatorias: {
        select: { tarea: { select: { id: true, nombre: true, orden: true } } },
      },
      personal: {
        where: { removedAt: null },
        select: {
          registradoEl: true,
          personal: { select: { id: true, nombre: true, apellido: true } },
          tareas: {
            select: {
              tarea: { select: { id: true, nombre: true, orden: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Qué anunciar de una visita: lo que se hizo si ya hay partes cargados, y si no
 * lo que se pidió. Una visita recién confirmada no tiene tareas hechas todavía,
 * y "Sin tareas registradas" no le dice nada al cliente.
 */
function tareasParaAvisar(visita: {
  tareasObligatorias: { tarea: { id: string; nombre: string; orden: number } }[];
  personal: {
    registradoEl: Date | null;
    personal: { id: string; nombre: string; apellido: string | null };
    tareas: { tarea: { id: string; nombre: string; orden: number } }[];
  }[];
}): string {
  const hechas = listaTareas(visita);
  if (visita.personal.some((p) => p.tareas.length > 0)) return hechas;
  const pedidas = visita.tareasObligatorias.map((o) => o.tarea.nombre);
  return pedidas.length > 0 ? pedidas.join(", ") : "Mantenimiento de jardín";
}

async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export async function pushConfirmacionVisita(visitaId: string): Promise<void> {
  const visita = await getVisitaForPush(visitaId);
  const userId = visita?.cliente.userId;
  if (!visita || !userId) return;

  await sendPushToUser(userId, {
    title: "Visita confirmada",
    body: `${tareasParaAvisar(visita)} — ${formatFechaCorta(visita.fechaProgramada)}`,
    data: { type: "visita_confirmada", visitaId },
  });
}

export async function pushRecordatorioCliente(visitaId: string): Promise<void> {
  const visita = await getVisitaForPush(visitaId);
  const userId = visita?.cliente.userId;
  if (!visita || !userId) return;

  await sendPushToUser(userId, {
    title: "Recordatorio de visita",
    body: `Mañana: ${tareasParaAvisar(visita)}`,
    data: { type: "visita_recordatorio", visitaId },
  });
}

export async function pushAlertaCompletada(visitaId: string): Promise<void> {
  const visita = await getVisitaForPush(visitaId);
  if (!visita) return;

  const admins = await getAdminUserIds();
  if (admins.length === 0) return;

  await sendPushToUsers(admins, {
    title: "Visita completada",
    body: `${nombreCliente(visita.cliente)} — ${tareasParaAvisar(visita)}`,
    data: { type: "visita_completada", visitaId },
  });
}

export async function pushAlertaIncompleta(visitaId: string): Promise<void> {
  const visita = await getVisitaForPush(visitaId);
  if (!visita) return;

  const admins = await getAdminUserIds();
  if (admins.length === 0) return;

  await sendPushToUsers(admins, {
    title: `Visita ${visita.estado.toLowerCase()}`,
    body: `${nombreCliente(visita.cliente)} — ${tareasParaAvisar(visita)}`,
    data: { type: "visita_incompleta", visitaId },
  });
}

// ──────────────────────────────────────────────
// Chat de visita
// ──────────────────────────────────────────────

export async function pushNuevoMensajeChat(messageId: string): Promise<void> {
  const message = await prisma.visitaMessage.findUnique({
    where: { id: messageId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          apellido: true,
          role: true,
          cliente: { select: { nombre: true, apellido: true, empresa: true } },
        },
      },
      media: { select: { id: true, tipo: true } },
      visita: {
        include: {
          cliente: {
            select: {
              userId: true,
              sectorId: true,
              nombre: true,
              apellido: true,
              empresa: true,
            },
          },
        },
      },
    },
  });
  if (!message) return;

  const visita = message.visita;
  const cliente = visita.cliente;

  const isClienteAuthor = message.author.role === "CLIENTE";
  const authorName = isClienteAuthor
    ? nombreCliente(message.author.cliente ?? cliente)
    : `${message.author.name ?? ""} ${message.author.apellido ?? ""}`.trim() ||
      "Equipo";
  const body = message.body ?? "";
  const truncatedBody =
    body.length > 100 ? `${body.slice(0, 97)}…` : body;
  let preview = truncatedBody;
  if (!body && message.media.length > 0) {
    const hasVideo = message.media.some((m) => m.tipo === "video");
    preview = hasVideo ? "📹 Video" : "📷 Imagen";
  } else if (body && message.media.length > 0) {
    const hasVideo = message.media.some((m) => m.tipo === "video");
    preview = `${hasVideo ? "📹" : "📷"} ${truncatedBody}`;
  }

  // Recipients: the "other side" only.
  let recipientIds: string[] = [];
  if (isClienteAuthor) {
    // Escribe el cliente: le avisa a la oficina. Antes se sumaban los capataces
    // del sector del cliente; ese rol ya no existe.
    recipientIds = await getAdminUserIds();
  } else {
    // Escribe la oficina: le avisa al cliente y a nadie más.
    if (cliente.userId) recipientIds = [cliente.userId];
  }

  // Don't notify the author themselves.
  recipientIds = recipientIds.filter((id) => id !== message.authorUserId);
  if (recipientIds.length === 0) return;

  await sendPushToUsers(recipientIds, {
    title: isClienteAuthor
      ? `Nuevo mensaje de ${authorName}`
      : `Vivero Francisco`,
    body: preview,
    data: {
      type: "chat_message",
      visitaId: visita.id,
      messageId: message.id,
    },
  });
}
