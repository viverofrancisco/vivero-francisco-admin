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
// Calificación de la visita
// ──────────────────────────────────────────────

/**
 * Le pide al cliente que califique, apenas la visita se cierra.
 *
 * Es el momento en que tiene algo que decir y en que se acuerda de lo que vio.
 * Un día después ya no distingue una poda de la otra, y a la semana no abre el
 * aviso.
 *
 * Reemplaza al aviso de mensaje nuevo del chat, que se fue: pedía que alguien
 * estuviera del otro lado, y esto pide una sola cosa que se contesta en dos
 * toques.
 */
export async function pushPedirCalificacion(visitaId: string): Promise<void> {
  const visita = await prisma.visita.findUnique({
    where: { id: visitaId },
    select: {
      estado: true,
      cliente: { select: { userId: true, nombre: true, apellido: true, empresa: true } },
      calificacion: { select: { id: true } },
    },
  });
  if (!visita) return;
  // Solo si de verdad terminó, y solo si todavía no calificó: volver a pedirlo
  // porque alguien corrigió una fecha es la forma de que dejen de abrirlos.
  if (visita.estado !== "COMPLETADA") return;
  if (visita.calificacion) return;
  if (!visita.cliente.userId) return;

  await sendPushToUsers([visita.cliente.userId], {
    title: "¿Cómo quedó tu jardín?",
    body: "Contanos qué te pareció la visita de hoy.",
    data: { type: "calificar_visita", visitaId },
  });
}
