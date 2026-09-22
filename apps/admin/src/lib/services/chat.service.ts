import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { pushChatAgregado, pushChatMensaje } from "@/lib/push/triggers";

/**
 * Los chats internos del equipo.
 *
 * **Entre cuentas del vivero, nunca con un cliente.** El cliente dice lo suyo
 * en la calificación de su visita; acá hablan la oficina y la gente de campo,
 * que es lo que hoy pasa por WhatsApp y no queda en ningún lado.
 *
 * Dos permisos y nada más:
 *
 * - **Armar el chat y decidir quién está adentro es del ADMIN.** Por ahora: es
 *   lo que se pidió, y es la parte que, mal hecha, mete a alguien donde no va.
 * - **Leer y escribir es de los miembros**, sean ADMIN, STAFF o PERSONAL. Estar
 *   adentro es lo único que da acceso: un admin que no es miembro tampoco lo
 *   ve, porque una conversación a la que cualquiera puede asomarse no es una
 *   conversación.
 */

export const MENSAJES_POR_PAGINA = 30;

/** Los roles que pueden estar en un chat. El cliente nunca. */
const ROLES_EN_CHATS = ["ADMIN", "STAFF", "PERSONAL"] as const;

const USUARIO_SELECT = {
  id: true,
  name: true,
  apellido: true,
  usuario: true,
  email: true,
  role: true,
} as const;

interface UsuarioCrudo {
  id: string;
  name: string | null;
  apellido: string | null;
  usuario: string | null;
  email: string | null;
  role: string;
}

/**
 * Cómo se llama alguien en un chat.
 *
 * El nombre si lo tiene; si no, el usuario con el que entra —que es como lo
 * nombra la oficina por teléfono— y recién al final el correo. Nunca un id.
 */
export function nombreDeUsuario(u: UsuarioCrudo): string {
  const nombre = `${u.name ?? ""} ${u.apellido ?? ""}`.trim();
  return nombre || u.usuario || u.email || "Alguien";
}

function ensureEnElEquipo(viewer: Viewer): void {
  if (viewer.role === "CLIENTE") throw new ForbiddenError();
}

function ensureAdmin(viewer: Viewer): void {
  if (viewer.role !== "ADMIN") {
    throw new ForbiddenError(
      "Solo un administrador puede crear chats o cambiar quién está adentro."
    );
  }
}

/**
 * Que el chat exista y que quien pregunta esté adentro.
 *
 * Devuelve la fila de miembro porque quien la pide suele necesitarla después
 * —para marcar lo leído, para contar lo que no leyó—, y pedirla dos veces es
 * dar dos respuestas a la misma pregunta.
 */
async function ensureMiembro(viewer: Viewer, chatId: string) {
  ensureEnElEquipo(viewer);
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, deletedAt: null },
    select: { id: true, nombre: true },
  });
  if (!chat) throw new NotFoundError("Chat no encontrado");

  const miembro = await prisma.chatMiembro.findFirst({
    where: { chatId, userId: viewer.id, salioEl: null },
    select: { id: true, leidoEl: true },
  });
  if (!miembro) throw new ForbiddenError("No estás en este chat.");
  return { chat, miembro };
}

/**
 * Los chats de quien pregunta, el más movido primero.
 *
 * Se ordena por el último mensaje y no por `updatedAt` del chat: lo que hace
 * que una conversación suba es que alguien escriba, no que le cambien el
 * nombre.
 */
export async function listChats(viewer: Viewer) {
  ensureEnElEquipo(viewer);

  const miembros = await prisma.chatMiembro.findMany({
    where: { userId: viewer.id, salioEl: null, chat: { deletedAt: null } },
    select: {
      leidoEl: true,
      chat: {
        select: {
          id: true,
          nombre: true,
          createdAt: true,
          _count: { select: { miembros: { where: { salioEl: null } } } },
          mensajes: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              texto: true,
              autorNombre: true,
              createdAt: true,
              _count: { select: { adjuntos: true } },
            },
          },
        },
      },
    },
  });

  /*
   * Una cuenta por chat, en paralelo. No hay forma de pedirle a la base "contá
   * los de cada chat desde una fecha distinta para cada uno" en una sola
   * consulta, y son cuentas por índice sobre una lista corta: la gente tiene
   * cinco o seis chats, no quinientos.
   */
  const conCuenta = await Promise.all(
    miembros.map(async (m) => {
      const sinLeer = await prisma.chatMensaje.count({
        where: {
          chatId: m.chat.id,
          deletedAt: null,
          // Lo propio nunca cuenta como no leído.
          autorId: { not: viewer.id },
          ...(m.leidoEl ? { createdAt: { gt: m.leidoEl } } : {}),
        },
      });
      const ultimo = m.chat.mensajes[0] ?? null;
      return {
        id: m.chat.id,
        nombre: m.chat.nombre,
        miembros: m.chat._count.miembros,
        sinLeer,
        ultimo: ultimo
          ? {
              texto: ultimo.texto,
              autorNombre: ultimo.autorNombre,
              createdAt: ultimo.createdAt,
              fotos: ultimo._count.adjuntos,
            }
          : null,
        // Para ordenar: un chat recién creado y sin mensajes va por su fecha.
        movidoEl: ultimo?.createdAt ?? m.chat.createdAt,
      };
    })
  );

  return conCuenta.sort(
    (a, b) => b.movidoEl.getTime() - a.movidoEl.getTime()
  );
}

/** El chat con su gente. Solo para quien está adentro. */
export async function getChat(viewer: Viewer, chatId: string) {
  const { miembro } = await ensureMiembro(viewer, chatId);
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: {
      id: true,
      nombre: true,
      createdAt: true,
      miembros: {
        where: { salioEl: null },
        orderBy: { agregadoEl: "asc" },
        select: { user: { select: USUARIO_SELECT } },
      },
    },
  });
  if (!chat) throw new NotFoundError("Chat no encontrado");

  return {
    id: chat.id,
    nombre: chat.nombre,
    creadoEl: chat.createdAt,
    leidoEl: miembro.leidoEl,
    /** Si puede tocar el nombre y la lista de miembros. */
    puedeEditar: viewer.role === "ADMIN",
    miembros: chat.miembros.map((m) => ({
      id: m.user.id,
      nombre: nombreDeUsuario(m.user),
      rol: m.user.role,
      /** Quien pregunta, para no mostrarse a sí mismo como "otro". */
      soyYo: m.user.id === viewer.id,
    })),
  };
}

/** A quién se puede meter en un chat: el equipo, sin los revocados. */
export async function miembrosPosibles(viewer: Viewer) {
  ensureAdmin(viewer);
  const usuarios = await prisma.user.findMany({
    where: {
      role: { in: [...ROLES_EN_CHATS] },
      // Alguien sin acceso no entra a la app: meterlo en un chat sería
      // ponerlo en una lista donde nunca va a aparecer.
      accesoRevocadoEl: null,
    },
    select: USUARIO_SELECT,
    orderBy: [{ name: "asc" }, { usuario: "asc" }],
  });
  return usuarios.map((u) => ({
    id: u.id,
    nombre: nombreDeUsuario(u),
    rol: u.role,
  }));
}

async function validarMiembros(ids: string[]): Promise<string[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];
  const encontrados = await prisma.user.findMany({
    where: {
      id: { in: unicos },
      role: { in: [...ROLES_EN_CHATS] },
      accesoRevocadoEl: null,
    },
    select: { id: true },
  });
  if (encontrados.length !== unicos.length) {
    throw new ValidationError(
      "Alguna de las personas elegidas ya no puede entrar a la app."
    );
  }
  return unicos;
}

/**
 * Crear un chat. **Quien lo crea queda adentro**, siempre: armar una
 * conversación y no poder abrirla no le sirve a nadie, y es el que va a tener
 * que sacar o agregar gente después.
 */
export async function createChat(
  viewer: Viewer,
  datos: { nombre: string; miembrosIds: string[] }
) {
  ensureAdmin(viewer);
  const nombre = datos.nombre.trim();
  if (!nombre) throw new ValidationError("El chat necesita un nombre.");

  const ids = await validarMiembros([...datos.miembrosIds, viewer.id]);

  const chat = await prisma.chat.create({
    data: {
      nombre,
      createdById: viewer.id,
      miembros: { create: ids.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });

  // Al que agregaron, y solo a él. Quien creó el chat ya sabe que existe.
  const avisar = ids.filter((id) => id !== viewer.id);
  if (avisar.length > 0) {
    pushChatAgregado(chat.id, avisar).catch(console.error);
  }
  return chat;
}

/**
 * Cambiar el nombre o la gente.
 *
 * Sacar a alguien **marca su fila**, no la borra: lo que escribió sigue ahí y
 * así se sabe que estuvo. Volver a agregarlo limpia la marca y le devuelve la
 * conversación entera, que es lo que espera quien vuelve a un grupo.
 */
export async function updateChat(
  viewer: Viewer,
  chatId: string,
  datos: { nombre?: string; miembrosIds?: string[] }
) {
  ensureAdmin(viewer);
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, deletedAt: null },
    select: { id: true },
  });
  if (!chat) throw new NotFoundError("Chat no encontrado");

  if (datos.nombre !== undefined) {
    const nombre = datos.nombre.trim();
    if (!nombre) throw new ValidationError("El chat necesita un nombre.");
    await prisma.chat.update({ where: { id: chatId }, data: { nombre } });
  }

  if (datos.miembrosIds === undefined) return;

  // Quien edita queda adentro: no puede sacarse a sí mismo sin querer y dejar
  // el chat sin nadie que pueda administrarlo.
  const queridos = await validarMiembros([...datos.miembrosIds, viewer.id]);
  const actuales = await prisma.chatMiembro.findMany({
    where: { chatId },
    select: { id: true, userId: true, salioEl: true },
  });

  const activos = new Set(
    actuales.filter((m) => m.salioEl === null).map((m) => m.userId)
  );
  const entran = queridos.filter((id) => !activos.has(id));
  const salen = actuales.filter(
    (m) => m.salioEl === null && !queridos.includes(m.userId)
  );

  await prisma.$transaction([
    ...salen.map((m) =>
      prisma.chatMiembro.update({
        where: { id: m.id },
        data: { salioEl: new Date() },
      })
    ),
    ...entran.map((userId) =>
      prisma.chatMiembro.upsert({
        where: { chatId_userId: { chatId, userId } },
        // Volver a entrar: se limpia la salida y se borra lo leído, así lo que
        // pasó mientras no estaba le aparece como nuevo.
        update: { salioEl: null, agregadoEl: new Date(), leidoEl: null },
        create: { chatId, userId },
      })
    ),
  ]);

  const avisar = entran.filter((id) => id !== viewer.id);
  if (avisar.length > 0) {
    pushChatAgregado(chatId, avisar).catch(console.error);
  }
}

/** Archivar el chat: deja de listarse, los mensajes no se tocan. */
export async function archivarChat(viewer: Viewer, chatId: string) {
  ensureAdmin(viewer);
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, deletedAt: null },
    select: { id: true },
  });
  if (!chat) throw new NotFoundError("Chat no encontrado");
  await prisma.chat.update({
    where: { id: chatId },
    data: { deletedAt: new Date() },
  });
}

const MENSAJE_SELECT = {
  id: true,
  texto: true,
  createdAt: true,
  deletedAt: true,
  autorId: true,
  autorNombre: true,
  adjuntos: { select: { id: true, url: true, tipo: true } },
  respondeA: {
    select: {
      id: true,
      texto: true,
      autorNombre: true,
      deletedAt: true,
      _count: { select: { adjuntos: true } },
    },
  },
} as const;

/**
 * Los mensajes, del más nuevo al más viejo y de a páginas.
 *
 * Al revés de como se leen, a propósito: una conversación se abre en el final,
 * así que la primera página es la de abajo y el cursor va hacia atrás. La
 * pantalla los da vuelta.
 */
export async function listMensajes(
  viewer: Viewer,
  chatId: string,
  opciones: { cursor?: string; limit?: number } = {}
) {
  await ensureMiembro(viewer, chatId);
  const limit = Math.min(opciones.limit ?? MENSAJES_POR_PAGINA, 100);

  const mensajes = await prisma.chatMensaje.findMany({
    where: { chatId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opciones.cursor
      ? { cursor: { id: opciones.cursor }, skip: 1 }
      : {}),
    select: MENSAJE_SELECT,
  });

  const hayMas = mensajes.length > limit;
  const pagina = hayMas ? mensajes.slice(0, limit) : mensajes;

  return {
    items: pagina.map((m) => mensajeParaPantalla(m, viewer.id)),
    cursor: hayMas ? (pagina[pagina.length - 1]?.id ?? null) : null,
  };
}

type MensajeCrudo = {
  id: string;
  texto: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  autorId: string | null;
  autorNombre: string;
  adjuntos: { id: string; url: string; tipo: string }[];
  respondeA: {
    id: string;
    texto: string | null;
    autorNombre: string;
    deletedAt: Date | null;
    _count: { adjuntos: number };
  } | null;
};

function mensajeParaPantalla(m: MensajeCrudo, viewerId: string) {
  return {
    id: m.id,
    // Un mensaje tachado no manda su texto al cliente: borrarlo es que no se
    // lea, y "borrado" es lo único que queda por decir.
    texto: m.deletedAt ? null : m.texto,
    fotos: m.deletedAt ? [] : m.adjuntos,
    createdAt: m.createdAt,
    borrado: m.deletedAt !== null,
    autorId: m.autorId,
    autorNombre: m.autorNombre,
    mio: m.autorId !== null && m.autorId === viewerId,
    respondeA: m.respondeA
      ? {
          id: m.respondeA.id,
          autorNombre: m.respondeA.autorNombre,
          texto: m.respondeA.deletedAt ? null : m.respondeA.texto,
          borrado: m.respondeA.deletedAt !== null,
          fotos: m.respondeA.deletedAt ? 0 : m.respondeA._count.adjuntos,
        }
      : null,
  };
}

export type MensajeDeChat = ReturnType<typeof mensajeParaPantalla>;

/**
 * Mandar un mensaje: texto, fotos, o las dos cosas.
 *
 * El nombre del autor se copia acá y no se lee después de `User`: renombrar una
 * cuenta no puede reescribir lo que alguien dijo ayer. Es el mismo par
 * id-más-copia que usan `Factura` y `OrdenLinea`.
 */
export async function enviarMensaje(
  viewer: Viewer,
  chatId: string,
  datos: {
    texto?: string | null;
    fotos?: { key: string; url: string; tipo?: string }[];
    respondeAId?: string | null;
  }
) {
  const { miembro } = await ensureMiembro(viewer, chatId);

  const texto = datos.texto?.trim() || null;
  const fotos = datos.fotos ?? [];
  if (!texto && fotos.length === 0) {
    throw new ValidationError("El mensaje no puede estar vacío.");
  }

  if (datos.respondeAId) {
    // Citar un mensaje de otro chat sería mostrarle a alguien algo de una
    // conversación en la que no está.
    const citado = await prisma.chatMensaje.count({
      where: { id: datos.respondeAId, chatId },
    });
    if (citado === 0) {
      throw new ValidationError("El mensaje que citás no está en este chat.");
    }
  }

  const autor = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: USUARIO_SELECT,
  });

  const mensaje = await prisma.chatMensaje.create({
    data: {
      chatId,
      texto,
      autorId: viewer.id,
      autorNombre: autor ? nombreDeUsuario(autor) : "Alguien",
      respondeAId: datos.respondeAId ?? null,
      adjuntos: {
        create: fotos.map((f) => ({
          key: f.key,
          url: f.url,
          tipo: f.tipo ?? "imagen",
        })),
      },
    },
    select: MENSAJE_SELECT,
  });

  // Lo propio ya está leído: si no, el chat quedaría con un no leído del que
  // uno mismo es el autor.
  await prisma.chatMiembro.update({
    where: { id: miembro.id },
    data: { leidoEl: new Date() },
  });

  pushChatMensaje(mensaje.id).catch(console.error);

  return mensajeParaPantalla(mensaje, viewer.id);
}

/** Marcar lo leído hasta ahora. Lo llama la pantalla al abrir el chat. */
export async function marcarLeido(viewer: Viewer, chatId: string) {
  const { miembro } = await ensureMiembro(viewer, chatId);
  await prisma.chatMiembro.update({
    where: { id: miembro.id },
    data: { leidoEl: new Date() },
  });
}

/**
 * Borrar un mensaje: el suyo cualquiera, el de otro solo el ADMIN.
 *
 * Se tacha, no se saca: es lo que dijo alguien, y una conversación con agujeros
 * no se entiende. Lo que desaparece es el contenido.
 */
export async function borrarMensaje(viewer: Viewer, mensajeId: string) {
  ensureEnElEquipo(viewer);
  const mensaje = await prisma.chatMensaje.findUnique({
    where: { id: mensajeId },
    select: { id: true, chatId: true, autorId: true, deletedAt: true },
  });
  if (!mensaje || mensaje.deletedAt) {
    throw new NotFoundError("Mensaje no encontrado");
  }
  await ensureMiembro(viewer, mensaje.chatId);
  if (mensaje.autorId !== viewer.id && viewer.role !== "ADMIN") {
    throw new ForbiddenError("Solo podés borrar tus propios mensajes.");
  }
  await prisma.chatMensaje.update({
    where: { id: mensajeId },
    data: { deletedAt: new Date() },
  });
}

/** Cuántos mensajes sin leer tiene en total, para el punto del menú. */
export async function contarSinLeer(viewer: Viewer): Promise<number> {
  if (viewer.role === "CLIENTE") return 0;
  const chats = await listChats(viewer);
  return chats.reduce((suma, c) => suma + c.sinLeer, 0);
}
