import { prisma } from "@/lib/prisma";
import {
  describirMotivoNovedad,
  fechaSola,
  nombreCliente,
  type MotivoNovedad,
} from "@vivero/shared";
import { listaTareas } from "@/lib/visita-tareas";
import { ZONA_ECUADOR } from "@/lib/fechas";
import { sendPushToUser, sendPushToUsers } from "./expo";

// `fechaProgramada` es `@db.Date`: el día, sin hora. Formatearlo en la zona
// del proceso lo corre al anterior y el aviso anuncia la visita del día que no
// es.
function formatFechaCorta(date: Date): string {
  return fechaSola(date, { weekday: "long", day: "numeric", month: "long" });
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
    // Con la etiqueta y no el enum en minúsculas: "Visita no_realizada" no es
    // una frase.
    title:
      visita.estado === "NO_REALIZADA"
        ? "Visita no realizada"
        : `Visita ${visita.estado.toLowerCase()}`,
    body: `${nombreCliente(visita.cliente)} — ${tareasParaAvisar(visita)}`,
    data: { type: "visita_incompleta", visitaId },
  });
}

// ──────────────────────────────────────────────
// Novedad: no se pudo hacer la visita
// ──────────────────────────────────────────────

/**
 * Alguien reportó desde el jardín que no pudo hacer la visita: **a la oficina,
 * en el momento**. Es el aviso que más vale por su hora: con la cuadrilla
 * todavía en la puerta se puede llamar al cliente y decidir si vuelven a las
 * tres o siguen a la próxima; una hora después es un viaje perdido.
 */
export async function pushNovedadDeVisita(novedadId: string): Promise<void> {
  const novedad = await prisma.visitaNovedad.findUnique({
    where: { id: novedadId },
    select: {
      motivo: true,
      nota: true,
      personalNombre: true,
      visita: {
        select: {
          id: true,
          numero: true,
          cliente: { select: { nombre: true, apellido: true, empresa: true } },
        },
      },
    },
  });
  if (!novedad) return;

  const admins = await getAdminUserIds();
  if (admins.length === 0) return;

  await sendPushToUsers(admins, {
    title: `Novedad en la visita #${novedad.visita.numero}`,
    body: `${novedad.personalNombre}: ${describirMotivoNovedad(
      novedad.motivo,
      novedad.nota
    )} — ${nombreCliente(novedad.visita.cliente)}`,
    data: { type: "visita_novedad", visitaId: novedad.visita.id },
  });
}

/** Lo que se le dice al cliente, por motivo. Con la hora cuando se sabe. */
const AVISO_AL_CLIENTE: Record<MotivoNovedad, (hora: string | null) => string> = {
  NADIE_EN_CASA: (hora) =>
    `Fuimos ${hora ? `a las ${hora}` : "hoy"} y no había nadie para recibirnos.`,
  SIN_ACCESO: (hora) =>
    `Fuimos ${hora ? `a las ${hora}` : "hoy"} y no pudimos ingresar a la propiedad.`,
  CLIENTE_CANCELO: (hora) =>
    `La visita quedó cancelada ${hora ? `a las ${hora}` : "hoy"}, ya en el sitio.`,
  OTRO: (hora) =>
    `Fuimos ${hora ? `a las ${hora}` : "hoy"} y no pudimos hacer el trabajo.`,
};

/**
 * La visita se cerró como no realizada: **al cliente**, con la hora a la que
 * se estuvo. Es la respuesta a "ustedes nunca vinieron", y conviene que le
 * llegue el mismo día y no cuando llega la orden.
 */
export async function pushVisitaNoRealizada(visitaId: string): Promise<void> {
  const visita = await prisma.visita.findUnique({
    where: { id: visitaId },
    select: {
      estado: true,
      motivoNoRealizada: true,
      cliente: { select: { userId: true } },
      novedades: {
        orderBy: { marcadaEl: "asc" },
        take: 1,
        select: { marcadaEl: true },
      },
    },
  });
  if (!visita || visita.estado !== "NO_REALIZADA") return;
  const userId = visita.cliente.userId;
  if (!userId) return;

  const marcada = visita.novedades[0]?.marcadaEl ?? null;
  const hora = marcada
    ? marcada.toLocaleTimeString("es-EC", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: ZONA_ECUADOR,
      })
    : null;
  const decir = AVISO_AL_CLIENTE[visita.motivoNoRealizada ?? "OTRO"];

  await sendPushToUser(userId, {
    title: "No pudimos hacer la visita",
    body: decir(hora),
    data: { type: "visita_no_realizada", visitaId },
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

// ──────────────────────────────────────────────
// Chats del equipo
// ──────────────────────────────────────────────

/**
 * Mensaje nuevo: **a todos los del chat menos a quien lo escribió**.
 *
 * El cuerpo es el mensaje, no "tienes un mensaje nuevo": la mitad de las veces
 * con leer la notificación alcanza y no hay que abrir nada. Una foto sin texto
 * se anuncia como foto, que es lo que es.
 */
export async function pushChatMensaje(mensajeId: string): Promise<void> {
  const mensaje = await prisma.chatMensaje.findUnique({
    where: { id: mensajeId },
    select: {
      id: true,
      texto: true,
      autorId: true,
      autorNombre: true,
      chat: {
        select: {
          id: true,
          nombre: true,
          miembros: {
            where: { salioEl: null },
            select: { userId: true },
          },
        },
      },
      _count: { select: { adjuntos: true } },
      adjuntos: { take: 1, select: { tipo: true } },
      referencia: true,
    },
  });
  if (!mensaje) return;

  const destinatarios = mensaje.chat.miembros
    .map((m) => m.userId)
    .filter((id) => id !== mensaje.autorId);
  if (destinatarios.length === 0) return;

  const primero = mensaje.adjuntos[0]?.tipo;
  const esVideo = primero === "video";
  const esDocumento = primero === "documento";
  const ficha = mensaje.referencia as { titulo?: string } | null;
  const cuerpo = mensaje.texto?.trim()
    ? mensaje.texto.trim()
    : ficha?.titulo
      ? `📌 ${ficha.titulo}`
      : mensaje._count.adjuntos === 1
      ? (esVideo ? "🎥 Video" : esDocumento ? "📄 Documento" : "📷 Foto")
      : `📎 ${mensaje._count.adjuntos} archivos`;

  await sendPushToUsers(destinatarios, {
    // El nombre del chat arriba y quién habló adelante del mensaje: es como se
    // lee un grupo, y con varios chats abiertos el título solo no alcanza.
    title: mensaje.chat.nombre,
    body: `${mensaje.autorNombre}: ${cuerpo}`,
    data: { type: "chat_mensaje", chatId: mensaje.chat.id, mensajeId },
  });
}

/**
 * Te agregaron a un chat: **solo a quien agregaron**.
 *
 * Los que ya estaban no se enteran por una notificación —no cambió nada para
 * ellos—; lo ven en la lista de miembros del chat.
 */
export async function pushChatAgregado(
  chatId: string,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { id: true, nombre: true },
  });
  if (!chat) return;

  await sendPushToUsers(userIds, {
    title: "Te agregaron a un chat",
    body: chat.nombre,
    data: { type: "chat_agregado", chatId: chat.id },
  });
}
