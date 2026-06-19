import { prisma } from "@/lib/prisma";
import { nombreCliente } from "@vivero/shared";
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
      clienteServicio: {
        include: {
          cliente: { select: { userId: true, nombre: true, apellido: true, empresa: true } },
          servicio: { select: { nombre: true } },
        },
      },
    },
  });
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
  const userId = visita?.clienteServicio.cliente.userId;
  if (!visita || !userId) return;

  await sendPushToUser(userId, {
    title: "Visita confirmada",
    body: `${visita.clienteServicio.servicio.nombre} — ${formatFechaCorta(visita.fechaProgramada)}`,
    data: { type: "visita_confirmada", visitaId },
  });
}

export async function pushRecordatorioCliente(visitaId: string): Promise<void> {
  const visita = await getVisitaForPush(visitaId);
  const userId = visita?.clienteServicio.cliente.userId;
  if (!visita || !userId) return;

  await sendPushToUser(userId, {
    title: "Recordatorio de visita",
    body: `Mañana: ${visita.clienteServicio.servicio.nombre}`,
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
    body: `${nombreCliente(visita.clienteServicio.cliente)} — ${visita.clienteServicio.servicio.nombre}`,
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
    body: `${nombreCliente(visita.clienteServicio.cliente)} — ${visita.clienteServicio.servicio.nombre}`,
    data: { type: "visita_incompleta", visitaId },
  });
}

// ──────────────────────────────────────────────
// Chat de visita
// ──────────────────────────────────────────────

async function getSectorAdminUserIds(sectorId: string | null): Promise<string[]> {
  if (!sectorId) return [];
  const rows = await prisma.sectorAdmin.findMany({
    where: { sectorId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

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
          clienteServicio: {
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
              servicio: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });
  if (!message) return;

  const visita = message.visita;
  const cliente = visita.clienteServicio.cliente;

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
    // Notify all ADMIN/STAFF + PERSONAL_ADMINs of the cliente's sector.
    const [adminIds, sectorAdminIds] = await Promise.all([
      getAdminUserIds(),
      getSectorAdminUserIds(cliente.sectorId),
    ]);
    recipientIds = [...new Set([...adminIds, ...sectorAdminIds])];
  } else {
    // Author is admin/personal_admin/staff → notify the cliente only.
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
