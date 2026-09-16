// Lightweight types matching the mobile API JSON responses. Server-side these
// come from Prisma; mobile only needs the read-shape, so we mirror what's used
// in screens. Keep in sync with the includes in
// apps/admin/src/lib/services/visita.service.ts and cliente.service.ts.

import type { EstadoVisita } from "@vivero/shared";

/** Una tarea, tal como viaja en el JSON de una visita. */
export interface TareaDeVisita {
  id: string;
  nombre: string;
  orden: number;
}

/**
 * Lo que una persona registró de su paso por la visita.
 *
 * Es el reemplazo de los productos: una visita ya no lleva un listado de lo que
 * se va a hacer, sino lo que **cada uno** hizo, cargado al terminar.
 */
export interface ParteDeVisita {
  personalId: string;
  personal: {
    id: string;
    nombre: string;
    apellido: string | null;
    tipo?: string;
  };
  /** Cuándo marcó, en ISO. `null` = todavía no marcó esa punta. */
  entradaEl: string | null;
  salidaEl: string | null;
  /** Dónde estaba al marcar. `null` = sin permiso, o sin señal. */
  entradaLat: number | null;
  entradaLng: number | null;
  salidaLat: number | null;
  salidaLng: number | null;
  /** `null` = todavía no cargó su parte. */
  registradoEl: string | null;
  tareas: { tarea: TareaDeVisita }[];
}

export interface VisitaSummary {
  id: string;
  /** El corto, el que se dice en voz alta: "la visita #194". */
  numero: number;
  fechaProgramada: string;
  horaEntrada: string | null;
  estado: EstadoVisita;
  /// Lo que la visita exige que se haga.
  tareasObligatorias: { tarea: TareaDeVisita }[];
  /// Quiénes van, y qué registró cada uno.
  personal: ParteDeVisita[];
}

type ConTareas = Pick<VisitaSummary, "tareasObligatorias" | "personal">;

/** Lo que se hizo: la unión de lo que cargó cada uno, sin repetir. */
export function tareasHechas(v: ConTareas): TareaDeVisita[] {
  const porId = new Map<string, TareaDeVisita>();
  for (const p of v.personal) {
    for (const { tarea } of p.tareas) porId.set(tarea.id, tarea);
  }
  return [...porId.values()].sort((a, b) => a.orden - b.orden);
}

/** Todo en una línea. Sin nada cargado, lo que se pidió. */
export function listaTareas(v: ConTareas): string {
  const hechas = tareasHechas(v).map((t) => t.nombre);
  if (hechas.length > 0) return hechas.join(", ");
  const pedidas = v.tareasObligatorias.map((o) => o.tarea.nombre);
  return pedidas.length > 0 ? pedidas.join(", ") : "Sin tareas registradas";
}

/** Resumido para espacios cortos: "A, B +2". */
export function resumenTareas(v: ConTareas, max = 2): string {
  const texto = listaTareas(v);
  const partes = texto.split(", ");
  if (partes.length <= max) return texto;
  return `${partes.slice(0, max).join(", ")} +${partes.length - max}`;
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
  /// La tarea con la que se etiquetó la foto al subirla, si tiene.
  tareaId: string | null;
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
  /** Qué es: algo que se ejecuta o algo que se despacha. */
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
