import { prisma } from "@/lib/prisma";
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
          cliente: { select: { userId: true, nombre: true } },
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
    body: `${visita.clienteServicio.cliente.nombre} — ${visita.clienteServicio.servicio.nombre}`,
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
    body: `${visita.clienteServicio.cliente.nombre} — ${visita.clienteServicio.servicio.nombre}`,
    data: { type: "visita_incompleta", visitaId },
  });
}
