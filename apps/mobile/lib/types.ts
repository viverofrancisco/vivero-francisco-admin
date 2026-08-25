// Lightweight types matching the mobile API JSON responses. Server-side these
// come from Prisma; mobile only needs the read-shape, so we mirror what's used
// in screens. Keep in sync with the includes in
// apps/admin/src/lib/services/visita.service.ts and cliente.service.ts.

import type { EstadoVisita } from "@vivero/shared";

/** Uno de los productos que cubre una visita. */
export interface VisitaProducto {
  productoId: string;
  /// Item de suscripción que lo cubre, o null si es un trabajo suelto.
  suscripcionItemId: string | null;
  producto: {
    id: string;
    nombre: string;
    descripcion: string | null;
    tipo: string;
  };
}

export interface VisitaSummary {
  id: string;
  fechaProgramada: string;
  horaEntrada: string | null;
  estado: EstadoVisita;
  /// Una visita puede cubrir varios servicios del mismo cliente.
  productos: VisitaProducto[];
}

/** Nombres de los servicios de una visita, en el orden guardado. */
export function nombresProductos(v: { productos: VisitaProducto[] }): string[] {
  return v.productos.map((vs) => vs.producto.nombre);
}

/** Todos los servicios en una línea. */
export function listaProductos(v: { productos: VisitaProducto[] }): string {
  const nombres = nombresProductos(v);
  return nombres.length > 0 ? nombres.join(", ") : "Sin servicio";
}

/** Servicios resumidos para espacios cortos: "A, B +2". */
export function resumenProductos(
  v: { productos: VisitaProducto[] },
  max = 2
): string {
  const nombres = nombresProductos(v);
  if (nombres.length === 0) return "Sin servicio";
  if (nombres.length <= max) return nombres.join(", ");
  return `${nombres.slice(0, max).join(", ")} +${nombres.length - max}`;
}

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
  createdAt: string;
  // Literal: did I author this?
  mine: boolean;
  // Same conversational side as me (team vs cliente)?
  sameSide: boolean;
}

export interface ChatListResponse {
  items: ChatMessage[];
  nextCursor: string | null;
  peerLastReadAt: string | null;
}

export interface InboxItem {
  visitaId: string;
  fechaProgramada: string;
  estado: string;
  servicioNombre: string;
  clienteNombre: string;
  lastMessage: {
    id: string;
    body: string | null;
    hasMedia: boolean;
    createdAt: string;
    authorUserId: string;
    authorName: string;
    mine: boolean;
  } | null;
  unreadCount: number;
}

export interface InboxResponse {
  items: InboxItem[];
  nextOffset: number | null;
}

export interface InboxSearchResult {
  resultId: string;
  visitaId: string;
  servicioNombre: string;
  clienteNombre: string;
  fechaProgramada: string;
  estado: string;
  unreadCount: number;
  match: {
    type: "name" | "message";
    text: string;
    createdAt: string;
    messageId?: string;
    authorName?: string;
    mine?: boolean;
  };
}

export interface InboxSearchResponse {
  items: InboxSearchResult[];
  nextOffset: number | null;
}

export interface VisitaMedia {
  id: string;
  key: string;
  url: string;
  tipo: string; // "imagen" | "video"
  createdAt: string;
  /// Producto de la visita al que se etiquetó la foto, si tiene.
  productoId: string | null;
}

export interface VisitaDetail extends VisitaSummary {
  horaSalida: string | null;
  notas: string | null;
  notasIncompleto: string | null;
  fechaRealizada: string | null;
  cliente: {
    id: string;
    userId: string | null;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
    telefono: string | null;
    direccion: string | null;
    ciudad: string | null;
    sector: { id: string; nombre: string } | null;
  };
  personal: {
    personalId: string;
    personal: {
      id: string;
      nombre: string;
      apellido: string | null;
      tipo: string;
    };
  }[];
  grupo: { id: string; nombre: string } | null;
  media: VisitaMedia[];
}

export interface ClienteProfileResponse {
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
    telefono: string | null;
    direccion: string | null;
    ciudad: string | null;
    sector: { id: string; nombre: string } | null;
  };
  proximaVisita: VisitaSummary | null;
}

export interface VisitasListResponse {
  items: VisitaDetail[];
  nextCursor: string | null;
}

// ──────────────────────────────────────────────
// Staff-side cliente list + detail
// ──────────────────────────────────────────────

export interface ClienteListItem {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  telefono: string | null;
  ciudad: string | null;
  sector: { id: string; nombre: string } | null;
}

export interface ClientesListResponse {
  items: ClienteListItem[];
  nextCursor: string | null;
}

export interface ClienteStaffDetail extends ClienteListItem {
  empresa: string | null;
  email: string | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  notas: string | null;
  metrosCuadrados: number | null;
  suscripciones: {
    id: string;
    estado: string;
    periodicidad: string;
    fechaInicio: string;
    items: {
      id: string;
      precio: string;
      ivaTasa: string | null;
      visitasPorPeriodo: number | null;
      producto: { id: string; nombre: string; tipo: string };
    }[];
  }[];
}

// ──────────────────────────────────────────────
// Servicios (admin only)
// ──────────────────────────────────────────────

export interface ServicioListItem {
  id: string;
  nombre: string;
  /** Qué es. Se mapea al `tipo` de Contífico (SER / PRO). */
  tipo: "SERVICIO" | "BIEN";
  /** Cómo se vende. Solo existe en el portal. */
  /** Porcentaje por defecto. En Ecuador conviven 0% y 15%. */
  ivaTasa: string | null;
  descripcion: string | null;
  _count: { suscripcionItems: number };
}

export interface ServiciosListResponse {
  items: ServicioListItem[];
  nextCursor: string | null;
}

export interface ServicioDetail extends ServicioListItem {
  createdAt: string;
}

export interface SectorOption {
  id: string;
  nombre: string;
}

export interface SectoresListResponse {
  items: SectorOption[];
}

export interface GrupoOption {
  id: string;
  nombre: string;
  miembrosIds: string[];
}

export interface GruposListResponse {
  items: GrupoOption[];
}

export interface PersonalOption {
  id: string;
  nombre: string;
  apellido: string | null;
  tipo: string;
}

export interface PersonalListResponse {
  items: PersonalOption[];
}
