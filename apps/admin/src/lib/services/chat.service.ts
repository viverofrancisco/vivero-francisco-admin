import { prisma } from "@/lib/prisma";
import { resumenProductos } from "@/lib/visita-productos";
import { nombreCliente } from "@vivero/shared";
import { ForbiddenError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { getVisitaForViewer } from "./visita.service";
import { pushNuevoMensajeChat } from "@/lib/push/triggers";
import { getUploadUrl, publicUrlForKey } from "@/lib/s3";
import { randomUUID } from "crypto";

export interface ChatMediaItem {
  id: string;
  url: string;
  tipo: "imagen" | "video";
}

export interface ChatMessage {
  id: string;
  visitaId: string;
  authorUserId: string;
  authorRole: string;
  authorName: string;
  body: string | null;
  media: ChatMediaItem[];
  createdAt: Date;
  // Literal: did the current viewer author this message?
  mine: boolean;
  // Conversational side: same as the viewer's side (team vs cliente)?
  // Used for left/right bubble alignment in the chat UI.
  sameSide: boolean;
}

export interface ChatMediaInput {
  key: string;
  tipo: "imagen" | "video";
}

const AUTHOR_INCLUDE = {
  author: {
    select: {
      id: true,
      name: true,
      apellido: true,
      role: true,
      cliente: { select: { nombre: true, apellido: true, empresa: true } },
    },
  },
  media: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      url: true,
      tipo: true,
    },
  },
} as const;

interface DbAuthor {
  id: string;
  name: string | null;
  apellido: string | null;
  role: string;
  cliente: { nombre: string; apellido: string | null; empresa: string | null } | null;
}

function authorDisplayName(a: DbAuthor): string {
  if (a.cliente) {
    return nombreCliente(a.cliente);
  }
  return `${a.name ?? ""} ${a.apellido ?? ""}`.trim() || "Equipo";
}

function shapeMessage(
  m: {
    id: string;
    visitaId: string;
    authorUserId: string;
    body: string | null;
    createdAt: Date;
    author: DbAuthor;
    media: { id: string; url: string; tipo: string }[];
  },
  viewer: Viewer
): ChatMessage {
  const authorIsCliente = m.author.role === "CLIENTE";
  const viewerIsCliente = viewer.role === "CLIENTE";
  return {
    id: m.id,
    visitaId: m.visitaId,
    authorUserId: m.authorUserId,
    authorRole: m.author.role,
    authorName: authorDisplayName(m.author),
    body: m.body,
    media: m.media.map((mm) => ({
      id: mm.id,
      url: mm.url,
      tipo: (mm.tipo === "video" ? "video" : "imagen") as "imagen" | "video",
    })),
    createdAt: m.createdAt,
    mine: m.authorUserId === viewer.id,
    sameSide: authorIsCliente === viewerIsCliente,
  };
}

// ──────────────────────────────────────────────
// list / send / read
// ──────────────────────────────────────────────

export interface ListMessagesOptions {
  cursor?: string;
  limit?: number;
}

export async function listMessages(
  visitaId: string,
  viewer: Viewer,
  options: ListMessagesOptions = {}
) {
  // Authorization piggybacks on visita visibility.
  const visita = await getVisitaForViewer(visitaId, viewer);

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const messages = await prisma.visitaMessage.findMany({
    where: { visitaId },
    include: AUTHOR_INCLUDE,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;

  // The "other side"'s most recent read timestamp. For a cliente viewer the
  // peer is anyone else; for an admin/personal_admin viewer it's the cliente.
  // We compute the latest read timestamp across all peers so the UI can show
  // "leído" once *anyone* on the other side has opened the chat.
  const peerWhere =
    viewer.role === "CLIENTE"
      ? {
          visitaId,
          userId: { not: viewer.id },
        }
      : {
          visitaId,
          userId:
            visita.cliente.userId &&
            visita.cliente.userId !== viewer.id
              ? visita.cliente.userId
              : "__never__",
        };

  const peerRead = await prisma.visitaChatRead.findFirst({
    where: peerWhere,
    orderBy: { lastReadAt: "desc" },
    select: { lastReadAt: true },
  });

  return {
    items: items.map((m) => shapeMessage(m, viewer)),
    nextCursor: hasMore ? items[items.length - 1].id : null,
    peerLastReadAt: peerRead?.lastReadAt ?? null,
  };
}

export interface SendMessagePayload {
  body?: string | null;
  media?: ChatMediaInput[];
}

export async function sendMessage(
  visitaId: string,
  viewer: Viewer,
  payload: SendMessagePayload
): Promise<ChatMessage> {
  // Authorization piggybacks on visita visibility.
  await getVisitaForViewer(visitaId, viewer);

  const trimmed = payload.body?.trim() || null;
  const media = payload.media ?? [];
  if (!trimmed && media.length === 0) {
    throw new ValidationError("El mensaje no puede estar vacío.");
  }
  if (trimmed && trimmed.length > 2000) {
    throw new ValidationError("El mensaje es demasiado largo.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.visitaMessage.create({
      data: {
        visitaId,
        authorUserId: viewer.id,
        body: trimmed,
      },
    });
    if (media.length > 0) {
      await tx.visitaMessageMedia.createMany({
        data: media.map((m) => ({
          messageId: message.id,
          key: m.key,
          url: publicUrlForKey(m.key),
          tipo: m.tipo,
        })),
      });
    }
    return tx.visitaMessage.findUniqueOrThrow({
      where: { id: message.id },
      include: AUTHOR_INCLUDE,
    });
  });

  // Mark sender as read so their own message doesn't show as unread.
  await prisma.visitaChatRead.upsert({
    where: { visitaId_userId: { visitaId, userId: viewer.id } },
    create: { visitaId, userId: viewer.id, lastReadAt: created.createdAt },
    update: { lastReadAt: created.createdAt },
  });

  // Fire push notifications to the other side. Best-effort.
  pushNuevoMensajeChat(created.id).catch((e) => console.error("push chat", e));

  return shapeMessage(created, viewer);
}

export interface ChatUploadDescriptor {
  key: string;
  uploadUrl: string;
  tipo: "imagen" | "video";
  contentType: string;
}

export async function requestChatMediaUploads(
  visitaId: string,
  viewer: Viewer,
  files: { fileName: string; contentType: string }[]
): Promise<ChatUploadDescriptor[]> {
  // Authorization piggybacks on visita visibility (anyone who can read the
  // chat can attach media).
  await getVisitaForViewer(visitaId, viewer);

  return Promise.all(
    files.map(async (f) => {
      const ext = f.fileName.includes(".") ? f.fileName.split(".").pop() : "";
      const key = `chat/${visitaId}/${randomUUID()}${ext ? `.${ext}` : ""}`;
      const uploadUrl = await getUploadUrl(key, f.contentType);
      const tipo: "imagen" | "video" = f.contentType.startsWith("video/")
        ? "video"
        : "imagen";
      return { key, uploadUrl, tipo, contentType: f.contentType };
    })
  );
}

export async function markChatRead(visitaId: string, viewer: Viewer) {
  await getVisitaForViewer(visitaId, viewer);
  await prisma.visitaChatRead.upsert({
    where: { visitaId_userId: { visitaId, userId: viewer.id } },
    create: { visitaId, userId: viewer.id },
    update: { lastReadAt: new Date() },
  });
}

// ──────────────────────────────────────────────
// inbox + unread count
// ──────────────────────────────────────────────

const INBOX_LIMIT = 100;

const INBOX_INCLUDE = {
  cliente: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      empresa: true,
      sectorId: true,
    },
  },
  productos: {
    orderBy: { posicion: "asc" },
    include: { producto: { select: { id: true, nombre: true } } },
  },
} as const;

export interface InboxItem {
  visitaId: string;
  fechaProgramada: Date;
  estado: string;
  servicioNombre: string;
  clienteNombre: string;
  lastMessage: {
    id: string;
    body: string | null;
    hasMedia: boolean;
    createdAt: Date;
    authorUserId: string;
    authorName: string;
    mine: boolean;
  } | null;
  unreadCount: number;
}

async function visibleVisitaIdsForViewer(viewer: Viewer): Promise<string[] | "all"> {
  if (isAdminRole(viewer.role)) return "all";
  if (viewer.role === "CLIENTE") {
    if (!viewer.clienteId) return [];
    const visitas = await prisma.visita.findMany({
      where: {
        deletedAt: null,
        clienteId: viewer.clienteId,
      },
      select: { id: true },
    });
    return visitas.map((v) => v.id);
  }
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorAdmins = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    const sectorIds = sectorAdmins.map((s) => s.sectorId);
    if (sectorIds.length === 0) return [];
    const visitas = await prisma.visita.findMany({
      where: {
        deletedAt: null,
        cliente: { sectorId: { in: sectorIds } },
      },
      select: { id: true },
    });
    return visitas.map((v) => v.id);
  }
  throw new ForbiddenError();
}

export interface ListInboxResult {
  items: InboxItem[];
  nextOffset: number | null;
}

export async function listInbox(
  viewer: Viewer,
  options: { offset?: number; limit?: number } = {}
): Promise<ListInboxResult> {
  const visibleIds = await visibleVisitaIdsForViewer(viewer);
  if (visibleIds !== "all" && visibleIds.length === 0) {
    return { items: [], nextOffset: null };
  }

  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);

  // Visitas that have at least one message and are visible to viewer.
  const visitaWhere: Record<string, unknown> = {
    deletedAt: null,
    messages: { some: {} },
    ...(visibleIds === "all" ? {} : { id: { in: visibleIds } }),
  };

  // Fetch one extra row to know if there's a next page without an extra
  // count query.
  const visitas = await prisma.visita.findMany({
    where: visitaWhere,
    include: {
      ...INBOX_INCLUDE,
      messages: {
        include: AUTHOR_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      chatReads: { where: { userId: viewer.id } },
    },
    orderBy: [{ updatedAt: "desc" }],
    skip: offset,
    take: limit + 1,
  });

  const hasMore = visitas.length > limit;
  const pageVisitas = hasMore ? visitas.slice(0, limit) : visitas;

  // Compute unread counts in a single grouped query, then index by visitaId.
  const unreadGroups = await Promise.all(
    pageVisitas.map(async (v) => {
      const lastRead = v.chatReads[0]?.lastReadAt ?? new Date(0);
      const count = await prisma.visitaMessage.count({
        where: {
          visitaId: v.id,
          authorUserId: { not: viewer.id },
          createdAt: { gt: lastRead },
        },
      });
      return [v.id, count] as const;
    })
  );
  const unreadByVisita = Object.fromEntries(unreadGroups);

  const items = pageVisitas
    .map((v) => {
      const last = v.messages[0];
      const cliente = v.cliente;
      return {
        visitaId: v.id,
        fechaProgramada: v.fechaProgramada,
        estado: v.estado,
        servicioNombre: resumenProductos(v),
        clienteNombre: nombreCliente(cliente),
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              hasMedia: last.media.length > 0,
              createdAt: last.createdAt,
              authorUserId: last.authorUserId,
              authorName: authorDisplayName(last.author),
              mine: last.authorUserId === viewer.id,
            }
          : null,
        unreadCount: unreadByVisita[v.id] ?? 0,
      };
    })
    .sort((a, b) => {
      const aTs = a.lastMessage?.createdAt.getTime() ?? 0;
      const bTs = b.lastMessage?.createdAt.getTime() ?? 0;
      return bTs - aTs;
    });

  return {
    items,
    nextOffset: hasMore ? offset + limit : null,
  };
}

// ──────────────────────────────────────────────
// Search inbox: per-match results, paginated.
// ──────────────────────────────────────────────

export interface InboxSearchResult {
  resultId: string;
  visitaId: string;
  servicioNombre: string;
  clienteNombre: string;
  fechaProgramada: Date;
  estado: string;
  unreadCount: number;
  match: {
    type: "name" | "message";
    text: string;
    createdAt: Date;
    messageId?: string;
    authorName?: string;
    mine?: boolean;
  };
}

export interface InboxSearchPage {
  items: InboxSearchResult[];
  nextOffset: number | null;
}

export async function searchInbox(
  viewer: Viewer,
  options: { q: string; offset?: number; limit?: number }
): Promise<InboxSearchPage> {
  const q = options.q.trim();
  if (q.length === 0) {
    return { items: [], nextOffset: null };
  }
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);

  const visibleIds = await visibleVisitaIdsForViewer(viewer);
  if (visibleIds !== "all" && visibleIds.length === 0) {
    return { items: [], nextOffset: null };
  }
  const visibleFilter =
    visibleIds === "all" ? {} : { visitaId: { in: visibleIds } };

  // 1) Find visitas whose cliente name matches the search. Split the query
  // into words so "Jorge Francisco" matches a cliente with nombre="Jorge"
  // and apellido="Francisco" (each word must hit nombre or apellido).
  const nameWords = q.split(/\s+/).filter(Boolean);
  const clienteAnd = nameWords.map((word) => ({
    OR: [
      { nombre: { contains: word, mode: "insensitive" as const } },
      { apellido: { contains: word, mode: "insensitive" as const } },
    ],
  }));

  const nameMatches = await prisma.visita.findMany({
    where: {
      deletedAt: null,
      ...(visibleIds === "all" ? {} : { id: { in: visibleIds } }),
      messages: { some: {} },
      // Coincide por nombre+apellido (todas las palabras) o por empresa
      // (clientes que solo tienen empresa, sin nombre de persona).
      cliente: {
        OR: [
          { AND: clienteAnd },
          { empresa: { contains: q, mode: "insensitive" } },
        ],
      },
    },
    include: {
      ...INBOX_INCLUDE,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      chatReads: { where: { userId: viewer.id } },
    },
  });

  // 2) Find messages whose body matches the search.
  const messageMatches = await prisma.visitaMessage.findMany({
    where: {
      ...visibleFilter,
      body: { contains: q, mode: "insensitive" },
      visita: { deletedAt: null },
    },
    include: {
      author: AUTHOR_INCLUDE.author,
      visita: {
        include: {
          ...INBOX_INCLUDE,
          chatReads: { where: { userId: viewer.id } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute unread counts per visita (one query per unique visita; the set
  // is bounded by name+message matches).
  const allVisitaIds = new Set<string>();
  for (const v of nameMatches) allVisitaIds.add(v.id);
  for (const m of messageMatches) allVisitaIds.add(m.visitaId);
  const lastReadByVisita = new Map<string, Date>();
  for (const v of nameMatches) {
    lastReadByVisita.set(
      v.id,
      v.chatReads[0]?.lastReadAt ?? new Date(0)
    );
  }
  for (const m of messageMatches) {
    if (!lastReadByVisita.has(m.visitaId)) {
      lastReadByVisita.set(
        m.visitaId,
        m.visita.chatReads[0]?.lastReadAt ?? new Date(0)
      );
    }
  }
  const unreadEntries = await Promise.all(
    Array.from(allVisitaIds).map(async (visitaId) => {
      const lastRead = lastReadByVisita.get(visitaId) ?? new Date(0);
      const count = await prisma.visitaMessage.count({
        where: {
          visitaId,
          authorUserId: { not: viewer.id },
          createdAt: { gt: lastRead },
        },
      });
      return [visitaId, count] as const;
    })
  );
  const unreadByVisita = Object.fromEntries(unreadEntries);

  const results: InboxSearchResult[] = [];

  // Name-match rows. The "match.text" is the cliente's full name; for the
  // sort time we use the visita's most recent message createdAt.
  for (const v of nameMatches) {
    const cliente = v.cliente;
    const clienteName = nombreCliente(cliente);
    const lastMsg = v.messages[0];
    results.push({
      resultId: `name-${v.id}`,
      visitaId: v.id,
      servicioNombre: resumenProductos(v),
      clienteNombre: clienteName,
      fechaProgramada: v.fechaProgramada,
      estado: v.estado,
      unreadCount: unreadByVisita[v.id] ?? 0,
      match: {
        type: "name",
        text: clienteName,
        createdAt: lastMsg?.createdAt ?? v.updatedAt,
      },
    });
  }

  // Message-match rows.
  for (const m of messageMatches) {
    const cliente = m.visita.cliente;
    const clienteName = nombreCliente(cliente);
    results.push({
      resultId: `message-${m.id}`,
      visitaId: m.visitaId,
      servicioNombre: resumenProductos(m.visita),
      clienteNombre: clienteName,
      fechaProgramada: m.visita.fechaProgramada,
      estado: m.visita.estado,
      unreadCount: unreadByVisita[m.visitaId] ?? 0,
      match: {
        type: "message",
        text: m.body ?? "",
        createdAt: m.createdAt,
        messageId: m.id,
        authorName: authorDisplayName(m.author),
        mine: m.authorUserId === viewer.id,
      },
    });
  }

  // Sort all results by match createdAt desc, then paginate.
  results.sort((a, b) => b.match.createdAt.getTime() - a.match.createdAt.getTime());

  const page = results.slice(offset, offset + limit);
  const hasMore = results.length > offset + limit;
  return {
    items: page,
    nextOffset: hasMore ? offset + limit : null,
  };
}

export async function totalUnreadForViewer(viewer: Viewer): Promise<number> {
  // Pull a wider window for the badge total so the count is reasonably
  // accurate even past the first page.
  const { items } = await listInbox(viewer, { limit: 100 });
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}
