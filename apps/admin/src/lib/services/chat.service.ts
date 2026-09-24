import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  fechaSola,
  nombreCliente,
  type EstadoDeMensaje,
  type ReferenciaEnMensaje,
  type TipoDeReferencia,
} from "@vivero/shared";
import { getVisitaForViewer, listVisitas } from "./visita.service";
import { getClienteForStaff, listClientes } from "./cliente.service";
import { getServicio, listServicios } from "./servicio.service";
import { globalSearch } from "./search.service";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { pushChatAgregado, pushChatMensaje } from "@/lib/push/triggers";
import { deleteObjects } from "@/lib/s3";

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
          imagenUrl: true,
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
              // El primero, para decir "📄 Documento" y no "📷 Foto".
              adjuntos: { take: 1, select: { tipo: true } },
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
        imagenUrl: m.chat.imagenUrl,
        miembros: m.chat._count.miembros,
        sinLeer,
        ultimo: ultimo
          ? {
              texto: ultimo.texto,
              autorNombre: ultimo.autorNombre,
              createdAt: ultimo.createdAt,
              fotos: ultimo._count.adjuntos,
              tipo: ultimo.adjuntos[0]?.tipo ?? null,
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
      imagenUrl: true,
      createdAt: true,
      miembros: {
        where: { salioEl: null },
        orderBy: { agregadoEl: "asc" },
        select: { user: { select: USUARIO_SELECT } },
      },
    },
  });
  if (!chat) throw new NotFoundError("Chat no encontrado");

  // Cuánto hay de cada cosa, para el renglón de la info. Tres cuentas por
  // índice; no vale la pena traerlos.
  const [fotosYVideos, documentos, enlaces] = await Promise.all([
    prisma.chatAdjunto.count({
      where: { mensaje: { chatId, deletedAt: null }, tipo: { in: ["imagen", "video"] } },
    }),
    prisma.chatAdjunto.count({
      where: { mensaje: { chatId, deletedAt: null }, tipo: "documento" },
    }),
    prisma.chatMensaje.count({
      where: { chatId, deletedAt: null, ...FILTRO_CON_ENLACE },
    }),
  ]);

  return {
    id: chat.id,
    nombre: chat.nombre,
    imagenUrl: chat.imagenUrl,
    creadoEl: chat.createdAt,
    leidoEl: miembro.leidoEl,
    medios: { fotosYVideos, documentos, enlaces },
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

/** Un mensaje con un enlace adentro: `http(s)://` o un `www.`. */
const FILTRO_CON_ENLACE = {
  OR: [
    { texto: { contains: "http://", mode: "insensitive" as const } },
    { texto: { contains: "https://", mode: "insensitive" as const } },
    { texto: { contains: "www.", mode: "insensitive" as const } },
  ],
};

const REGEX_ENLACE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;

/** Los enlaces que hay en un texto, sin repetir y sin el punto final pegado. */
export function enlacesEn(texto: string): string[] {
  const vistos = new Set<string>();
  for (const m of texto.match(REGEX_ENLACE) ?? []) {
    vistos.add(m.replace(/[.,;:!?]+$/, ""));
  }
  return [...vistos];
}

/**
 * Lo que se mandó en el chat, aparte de leerlo: las fotos y videos, o los
 * mensajes con enlaces. Del más nuevo al más viejo, de a páginas, como los
 * mensajes. Solo para quien está adentro.
 */
export async function mediosDelChat(
  viewer: Viewer,
  chatId: string,
  opciones: {
    tipo: "archivos" | "enlaces" | "documentos";
    cursor?: string;
    limit?: number;
  }
) {
  await ensureMiembro(viewer, chatId);
  const limit = Math.min(opciones.limit ?? 60, 200);

  if (opciones.tipo === "archivos" || opciones.tipo === "documentos") {
    const adjuntos = await prisma.chatAdjunto.findMany({
      where: {
        mensaje: { chatId, deletedAt: null },
        tipo:
          opciones.tipo === "documentos"
            ? "documento"
            : { in: ["imagen", "video"] },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opciones.cursor ? { cursor: { id: opciones.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        mensajeId: true,
        url: true,
        tipo: true,
        nombre: true,
        tamano: true,
        urlMovil: true,
        urlTablet: true,
        urlEscritorio: true,
        posterUrl: true,
        createdAt: true,
      },
    });
    const hayMas = adjuntos.length > limit;
    const pagina = hayMas ? adjuntos.slice(0, limit) : adjuntos;
    return {
      items: pagina,
      cursor: hayMas ? (pagina[pagina.length - 1]?.id ?? null) : null,
    };
  }

  const mensajes = await prisma.chatMensaje.findMany({
    where: { chatId, deletedAt: null, ...FILTRO_CON_ENLACE },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(opciones.cursor ? { cursor: { id: opciones.cursor }, skip: 1 } : {}),
    select: { id: true, texto: true, autorNombre: true, createdAt: true },
  });
  const hayMas = mensajes.length > limit;
  const pagina = hayMas ? mensajes.slice(0, limit) : mensajes;
  return {
    items: pagina.map((m) => ({
      mensajeId: m.id,
      autorNombre: m.autorNombre,
      texto: m.texto ?? "",
      urls: enlacesEn(m.texto ?? ""),
      createdAt: m.createdAt,
    })),
    cursor: hayMas ? (pagina[pagina.length - 1]?.id ?? null) : null,
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
  datos: {
    nombre?: string;
    miembrosIds?: string[];
    /** La foto del grupo: una clave subida bajo el prefijo del chat, o `null` para quitarla. */
    imagen?: { key: string; url: string } | null;
  }
) {
  ensureAdmin(viewer);
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, deletedAt: null },
    select: { id: true, imagenKey: true },
  });
  if (!chat) throw new NotFoundError("Chat no encontrado");

  if (datos.nombre !== undefined) {
    const nombre = datos.nombre.trim();
    if (!nombre) throw new ValidationError("El chat necesita un nombre.");
    await prisma.chat.update({ where: { id: chatId }, data: { nombre } });
  }

  /*
   * La foto del grupo. Solo una clave del prefijo de **este** chat: la firma
   * se pidió por `/chats/[id]/fotos`, y aceptar cualquier clave sería dejar
   * que un chat muestre como suya la foto de otro. La anterior se borra de R2
   * cuando se reemplaza o se quita: nadie la tiene ya en pantalla.
   */
  if (datos.imagen !== undefined) {
    if (datos.imagen && !datos.imagen.key.startsWith(`chats/${chatId}/`)) {
      throw new ValidationError("La foto no es de este chat.");
    }
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        imagenKey: datos.imagen?.key ?? null,
        imagenUrl: datos.imagen?.url ?? null,
      },
    });
    if (chat.imagenKey && chat.imagenKey !== datos.imagen?.key) {
      deleteObjects([chat.imagenKey]).catch(console.error);
    }
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
  idCliente: true,
  referencia: true,
  // Quiénes lo leyeron: alcanza con los ids para decir si lo leyeron todos.
  lecturas: { select: { userId: true } },
  adjuntos: {
    select: {
      id: true,
      url: true,
      tipo: true,
      nombre: true,
      tamano: true,
      urlMovil: true,
      urlTablet: true,
      urlEscritorio: true,
      posterUrl: true,
    },
  },
  respondeA: {
    select: {
      id: true,
      texto: true,
      autorNombre: true,
      deletedAt: true,
      _count: { select: { adjuntos: true } },
      // La primera, para la miniatura de la cita: "📷 Foto" no dice cuál.
      adjuntos: { take: 1, select: { url: true, urlMovil: true, posterUrl: true, tipo: true } },
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
  opciones: { cursor?: string; limit?: number; alrededorDe?: string } = {}
) {
  await ensureMiembro(viewer, chatId);
  const otros = await otrosMiembros(chatId, viewer.id);
  const limit = Math.min(opciones.limit ?? MENSAJES_POR_PAGINA, 100);

  /*
   * Llegando desde el buscador, la conversación no se abre por el final sino
   * **alrededor** del mensaje encontrado: hay que traer los de antes y los de
   * después, o el mensaje aparece pegado a un borde sin nada que lo explique.
   */
  if (opciones.alrededorDe) {
    const centro = await prisma.chatMensaje.findFirst({
      where: { id: opciones.alrededorDe, chatId },
      select: { createdAt: true },
    });
    if (!centro) throw new NotFoundError("Mensaje no encontrado");

    const [nuevos, viejos] = await Promise.all([
      prisma.chatMensaje.findMany({
        where: { chatId, createdAt: { gt: centro.createdAt } },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: MENSAJE_SELECT,
      }),
      prisma.chatMensaje.findMany({
        where: { chatId, createdAt: { lte: centro.createdAt } },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        select: MENSAJE_SELECT,
      }),
    ]);

    const hayMasViejos = viejos.length > limit;
    const pagina = [
      ...[...nuevos].reverse(),
      ...(hayMasViejos ? viejos.slice(0, limit) : viejos),
    ];
    return {
      items: pagina.map((m) => mensajeParaPantalla(m, viewer.id, otros)),
      cursor: hayMasViejos
        ? (pagina[pagina.length - 1]?.id ?? null)
        : null,
    };
  }

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
    items: pagina.map((m) => mensajeParaPantalla(m, viewer.id, otros)),
    cursor: hayMas ? (pagina[pagina.length - 1]?.id ?? null) : null,
  };
}

/**
 * Los demás miembros del chat, hoy: contra ellos se decide si un mensaje
 * propio "lo leyeron todos". Quien salió del chat no cuenta —no va a leerlo—
 * y quien entró después sí, hasta que abra la conversación.
 */
async function otrosMiembros(chatId: string, viewerId: string) {
  const miembros = await prisma.chatMiembro.findMany({
    where: { chatId, salioEl: null, userId: { not: viewerId } },
    select: { userId: true },
  });
  return miembros.map((m) => m.userId);
}

type MensajeCrudo = {
  id: string;
  texto: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  autorId: string | null;
  autorNombre: string;
  idCliente: string | null;
  referencia: unknown;
  lecturas: { userId: string }[];
  adjuntos: {
    id: string;
    url: string;
    tipo: string;
    nombre: string | null;
    tamano: number | null;
    urlMovil: string | null;
    urlTablet: string | null;
    urlEscritorio: string | null;
    posterUrl: string | null;
  }[];
  respondeA: {
    id: string;
    texto: string | null;
    autorNombre: string;
    deletedAt: Date | null;
    _count: { adjuntos: number };
    adjuntos: { url: string; urlMovil: string | null; posterUrl: string | null; tipo: string }[];
  } | null;
};

/**
 * @param otros Los demás miembros de hoy: un mensaje propio está `leido`
 *   cuando **cada uno** de ellos tiene su lectura. Con nadie más en el chat no
 *   hay quien lo lea, así que queda en `enviado`.
 */
function mensajeParaPantalla(
  m: MensajeCrudo,
  viewerId: string,
  otros: string[]
) {
  const mio = m.autorId !== null && m.autorId === viewerId;
  const leyeron = new Set(m.lecturas.map((l) => l.userId));
  const estado: EstadoDeMensaje =
    mio && otros.length > 0 && otros.every((id) => leyeron.has(id))
      ? "leido"
      : "enviado";
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
    mio,
    idCliente: m.idCliente,
    estado,
    referencia: m.deletedAt ? null : referenciaGuardada(m.referencia),
    respondeA: m.respondeA
      ? {
          id: m.respondeA.id,
          autorNombre: m.respondeA.autorNombre,
          texto: m.respondeA.deletedAt ? null : m.respondeA.texto,
          borrado: m.respondeA.deletedAt !== null,
          fotos: m.respondeA.deletedAt ? 0 : m.respondeA._count.adjuntos,
          // La chica, si ya está: es una miniatura de 36 px.
          miniatura:
            !m.respondeA.deletedAt && m.respondeA.adjuntos[0]
              ? {
                  // La chica si ya está; de un video, su póster.
                  url:
                    m.respondeA.adjuntos[0].posterUrl ??
                    m.respondeA.adjuntos[0].urlMovil ??
                    m.respondeA.adjuntos[0].url,
                  tipo: m.respondeA.adjuntos[0].tipo,
                }
              : null,
        }
      : null,
  };
}

export type MensajeDeChat = ReturnType<typeof mensajeParaPantalla>;

/** "mié 23 sept": la fecha de una visita en una tarjeta, donde no hay lugar para el año. */
const FECHA_CORTA: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

/** Lo que hay en la columna `referencia`, si tiene la forma esperada. */
function referenciaGuardada(crudo: unknown): ReferenciaEnMensaje | null {
  if (!crudo || typeof crudo !== "object") return null;
  const r = crudo as Partial<ReferenciaEnMensaje>;
  if (!r.tipo || !r.id || typeof r.titulo !== "string") return null;
  return { tipo: r.tipo, id: r.id, titulo: r.titulo, detalle: r.detalle ?? "" };
}

/**
 * La tarjeta de una ficha compartida, armada **del lado del servidor** con lo
 * que quien la manda puede leer: pasar por el servicio de cada cosa es lo que
 * aplica sus reglas de acceso —un jardinero comparte una visita suya, no
 * cualquiera—. El título y el detalle quedan copiados en el mensaje.
 */
async function tarjetaDeReferencia(
  viewer: Viewer,
  ref: { tipo: TipoDeReferencia; id: string }
): Promise<ReferenciaEnMensaje> {
  if (ref.tipo === "visita") {
    const v = await getVisitaForViewer(ref.id, viewer);
    return {
      tipo: "visita",
      id: v.id,
      titulo: `Visita #${v.numero} · ${nombreCliente(v.cliente)}`,
      detalle: [fechaSola(v.fechaProgramada, FECHA_CORTA), v.propiedad?.nombre]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (ref.tipo === "cliente") {
    const c = await getClienteForStaff(ref.id, viewer);
    return {
      tipo: "cliente",
      id: c.id,
      titulo: nombreCliente(c),
      detalle: c.telefono ?? "",
    };
  }
  const p = await getServicio(ref.id, viewer);
  return {
    tipo: "producto",
    id: p.id,
    titulo: p.nombre,
    detalle: p.tipo === "SERVICIO" ? "Servicio" : "Producto",
  };
}

/**
 * Qué se puede compartir: visitas, clientes o productos, con un texto para
 * buscar. Sin texto, lo cercano —las visitas de esta semana, los primeros
 * clientes y productos—; con texto, el buscador global para visitas y
 * clientes (ya sabe de números y de nombre-apellido) y el catálogo para los
 * productos. Todo pasa por los servicios de cada cosa, que aplican quién ve qué.
 */
export async function compartibles(
  viewer: Viewer,
  tipo: TipoDeReferencia,
  q?: string
): Promise<ReferenciaEnMensaje[]> {
  ensureEnElEquipo(viewer);
  const texto = (q ?? "").trim();

  if (tipo === "producto") {
    const { items } = await listServicios(viewer, {
      search: texto || undefined,
      limit: 30,
    });
    return items.map((p) => ({
      tipo,
      id: p.id,
      titulo: p.nombre,
      detalle: p.tipo === "SERVICIO" ? "Servicio" : "Producto",
    }));
  }

  if (texto.length > 0) {
    const r = await globalSearch(viewer, texto, 30);
    const grupo = tipo === "visita" ? r.visitas : r.clientes;
    return grupo.items.map((i) => ({
      tipo,
      id: i.id,
      titulo: i.title,
      detalle: [i.subtitle, i.detalle].filter(Boolean).join(" · "),
    }));
  }

  if (tipo === "cliente") {
    const { items } = await listClientes(viewer, { limit: 30 });
    return items.map((c) => ({
      tipo,
      id: c.id,
      titulo: nombreCliente(c),
      detalle: c.telefono ?? "",
    }));
  }

  // Visitas sin texto: la semana alrededor de hoy, que es lo que se comparte.
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - 7 * 86400000);
  const hasta = new Date(hoy.getTime() + 7 * 86400000);
  const { items } = await listVisitas(viewer, { from: desde, to: hasta, limit: 30 });
  return items.map((v) => ({
    tipo,
    id: v.id,
    titulo: `Visita #${v.numero} · ${nombreCliente(v.cliente)}`,
    detalle: [fechaSola(v.fechaProgramada, FECHA_CORTA), v.propiedad?.nombre]
      .filter(Boolean)
      .join(" · "),
  }));
}

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
    fotos?: { key: string; url: string; nombre?: string; tipo?: string; tamano?: number | null }[];
    respondeAId?: string | null;
    idCliente?: string;
    /** Una ficha para compartir: el servidor arma la tarjeta. */
    referencia?: { tipo: TipoDeReferencia; id: string } | null;
  }
) {
  const { miembro } = await ensureMiembro(viewer, chatId);
  const otros = await otrosMiembros(chatId, viewer.id);

  /*
   * El mismo mensaje dos veces es un reintento, no dos mensajes: la pantalla lo
   * manda apenas se escribe y, si la conexión se cortó sin respuesta, lo
   * vuelve a mandar con el mismo `idCliente`. Se contesta con el que ya está.
   */
  if (datos.idCliente) {
    const previo = await prisma.chatMensaje.findUnique({
      where: { chatId_idCliente: { chatId, idCliente: datos.idCliente } },
      select: MENSAJE_SELECT,
    });
    if (previo) {
      if (previo.autorId !== viewer.id) {
        throw new ValidationError("Ese id de mensaje ya se usó en este chat.");
      }
      return mensajeParaPantalla(previo, viewer.id, otros);
    }
  }

  const texto = datos.texto?.trim() || null;
  const fotos = datos.fotos ?? [];
  const referencia = datos.referencia
    ? await tarjetaDeReferencia(viewer, datos.referencia)
    : null;
  if (!texto && fotos.length === 0 && !referencia) {
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

  let mensaje;
  try {
    mensaje = await prisma.chatMensaje.create({
      data: {
        chatId,
        texto,
        autorId: viewer.id,
        autorNombre: autor ? nombreDeUsuario(autor) : "Alguien",
        respondeAId: datos.respondeAId ?? null,
        idCliente: datos.idCliente ?? null,
        // `InputJsonObject` pide una firma de índice que una interfaz no
        // tiene; es un objeto plano de cuatro textos, así que el cast es honesto.
        referencia: referencia
          ? (referencia as unknown as Prisma.InputJsonObject)
          : Prisma.JsonNull,
        adjuntos: {
          create: fotos.map((f) => ({
            key: f.key,
            url: f.url,
            // El nombre con el que la mandaron: es por lo único que después se
            // la puede buscar.
            nombre: f.nombre ?? null,
            tipo: f.tipo ?? "imagen",
            tamano: f.tamano ?? null,
          })),
        },
      },
      select: MENSAJE_SELECT,
    });
  } catch (error) {
    // Dos reintentos a la vez —el segundo salió antes de que volviera el
    // primero—: el índice único frena al segundo, y la respuesta es la misma.
    if (
      datos.idCliente &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const previo = await prisma.chatMensaje.findUnique({
        where: { chatId_idCliente: { chatId, idCliente: datos.idCliente } },
        select: MENSAJE_SELECT,
      });
      if (previo && previo.autorId === viewer.id) {
        return mensajeParaPantalla(previo, viewer.id, otros);
      }
    }
    throw error;
  }

  // Escribir es haber leído lo de arriba: si no, el chat quedaría con un no
  // leído del que uno mismo es el autor, y los mensajes ajenos que estaban a
  // la vista sin su lectura.
  await registrarLecturas(chatId, viewer.id, miembro.leidoEl);

  pushChatMensaje(mensaje.id).catch(console.error);

  return mensajeParaPantalla(mensaje, viewer.id, otros);
}

/**
 * Anotar lo leído: una fila por cada mensaje ajeno que llegó desde la última
 * vez, y la marca del miembro corrida hasta el más nuevo.
 *
 * La marca queda en la fecha del **último mensaje visto** y no en "ahora": así
 * un mensaje que entre entre la consulta y la escritura no queda debajo de la
 * marca sin su lectura, y lo no leído sigue siendo "lo más nuevo que la marca",
 * que es lo que siempre fue. Sin nada nuevo no se escribe nada, y eso es lo
 * que hace barato llamarlo cada cinco segundos con el chat abierto.
 */
async function registrarLecturas(
  chatId: string,
  userId: string,
  desde: Date | null
) {
  const nuevos = await prisma.chatMensaje.findMany({
    where: { chatId, ...(desde ? { createdAt: { gt: desde } } : {}) },
    select: { id: true, autorId: true, createdAt: true },
  });
  if (nuevos.length === 0) return;
  const ajenos = nuevos.filter((m) => m.autorId !== userId);
  const ultimo = nuevos.reduce(
    (max, m) => (m.createdAt > max ? m.createdAt : max),
    nuevos[0].createdAt
  );
  await prisma.$transaction([
    ...(ajenos.length > 0
      ? [
          prisma.chatLectura.createMany({
            data: ajenos.map((m) => ({ mensajeId: m.id, userId })),
            skipDuplicates: true,
          }),
        ]
      : []),
    prisma.chatMiembro.update({
      where: { chatId_userId: { chatId, userId } },
      data: { leidoEl: ultimo },
    }),
  ]);
}

/** Marcar lo leído hasta ahora. Lo llama la pantalla al abrir el chat, y después cada tanto mientras está abierto. */
export async function marcarLeido(viewer: Viewer, chatId: string) {
  const { miembro } = await ensureMiembro(viewer, chatId);
  await registrarLecturas(chatId, viewer.id, miembro.leidoEl);
}

/**
 * La info de un mensaje: quién lo leyó y cuándo, y a quién le falta. Solo de
 * los propios —es "¿ya vieron lo que mandé?"—, como en WhatsApp.
 */
export async function infoDeMensaje(viewer: Viewer, mensajeId: string) {
  ensureEnElEquipo(viewer);
  const mensaje = await prisma.chatMensaje.findUnique({
    where: { id: mensajeId },
    select: {
      ...MENSAJE_SELECT,
      chatId: true,
      lecturas: {
        select: { userId: true, leidoEl: true, user: { select: USUARIO_SELECT } },
      },
    },
  });
  if (!mensaje) throw new NotFoundError("Mensaje no encontrado");
  await ensureMiembro(viewer, mensaje.chatId);
  if (mensaje.autorId !== viewer.id) {
    throw new ForbiddenError("Solo puedes ver la info de tus mensajes.");
  }

  const miembros = await prisma.chatMiembro.findMany({
    where: { chatId: mensaje.chatId, salioEl: null, userId: { not: viewer.id } },
    select: { user: { select: USUARIO_SELECT } },
    orderBy: { agregadoEl: "asc" },
  });
  const lecturaDe = new Map(mensaje.lecturas.map((l) => [l.userId, l]));
  const leidoPor = miembros
    .filter((m) => lecturaDe.has(m.user.id))
    .map((m) => ({
      id: m.user.id,
      nombre: nombreDeUsuario(m.user),
      leidoEl: lecturaDe.get(m.user.id)!.leidoEl,
    }))
    // El que lo leyó más recién arriba, como en WhatsApp.
    .sort((a, b) => b.leidoEl.getTime() - a.leidoEl.getTime());
  const sinLeer = miembros
    .filter((m) => !lecturaDe.has(m.user.id))
    .map((m) => ({ id: m.user.id, nombre: nombreDeUsuario(m.user) }));

  return {
    mensaje: mensajeParaPantalla(
      mensaje,
      viewer.id,
      miembros.map((m) => m.user.id)
    ),
    leidoPor,
    sinLeer,
  };
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
    throw new ForbiddenError("Solo puedes borrar tus propios mensajes.");
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

/**
 * Buscar entre los mensajes de los chats donde uno está.
 *
 * Busca en el texto y **en el nombre de los archivos**: una foto no tiene
 * palabras, así que lo único por lo que se la puede encontrar es cómo se
 * llamaba cuando la mandaron. Por eso `ChatAdjunto.nombre` existe.
 *
 * El alcance sale de la misma regla de siempre: los chats donde la persona es
 * miembro **hoy**. Alguien a quien sacaron de un grupo no encuentra por el
 * buscador lo que ya no puede abrir.
 */
export async function buscarMensajes(
  viewer: Viewer,
  q: string,
  limit = 30
) {
  ensureEnElEquipo(viewer);
  const texto = q.trim();
  if (texto.length < 2) return [];

  const mios = await prisma.chatMiembro.findMany({
    where: { userId: viewer.id, salioEl: null, chat: { deletedAt: null } },
    select: { chatId: true },
  });
  if (mios.length === 0) return [];
  const chatIds = mios.map((m) => m.chatId);

  const mensajes = await prisma.chatMensaje.findMany({
    where: {
      chatId: { in: chatIds },
      deletedAt: null,
      OR: [
        { texto: { contains: texto, mode: "insensitive" } },
        {
          adjuntos: {
            some: { nombre: { contains: texto, mode: "insensitive" } },
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 50),
    select: {
      id: true,
      texto: true,
      createdAt: true,
      autorId: true,
      autorNombre: true,
      chat: { select: { id: true, nombre: true, imagenUrl: true } },
      adjuntos: { select: { id: true, url: true, urlMovil: true, nombre: true, tipo: true } },
    },
  });

  return mensajes.map((m) => {
    // Cuál de las fotos hizo el match: es la que hay que mostrar, no la
    // primera del mensaje.
    const coincide = m.adjuntos.find((a) =>
      a.nombre?.toLowerCase().includes(texto.toLowerCase())
    );
    return {
      id: m.id,
      chatId: m.chat.id,
      chatNombre: m.chat.nombre,
      chatImagenUrl: m.chat.imagenUrl,
      autorNombre: m.autorNombre,
      mio: m.autorId !== null && m.autorId === viewer.id,
      texto: m.texto,
      createdAt: m.createdAt,
      foto: coincide
        ? {
            id: coincide.id,
            // La chica para el renglón del resultado, si ya está.
            url: coincide.urlMovil ?? coincide.url,
            nombre: coincide.nombre,
            tipo: coincide.tipo,
          }
        : null,
      /** Cuántas fotos trae el mensaje, para decirlo cuando no hay texto. */
      fotos: m.adjuntos.length,
    };
  });
}

export type ResultadoDeBusqueda = Awaited<
  ReturnType<typeof buscarMensajes>
>[number];
