// Lightweight types matching the mobile API JSON responses. Server-side these
// come from Prisma; mobile only needs the read-shape, so we mirror what's used
// in screens. Keep in sync with the includes in
// apps/admin/src/lib/services/visita.service.ts and cliente.service.ts.

import type { EstadoVisita } from "@vivero/shared";

export interface VisitaSummary {
  id: string;
  fechaProgramada: string;
  horaEntrada: string | null;
  estado: EstadoVisita;
  clienteServicio: {
    servicio: { id: string; nombre: string; tipo: string };
  };
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
}

export interface VisitaDetail extends VisitaSummary {
  horaSalida: string | null;
  notas: string | null;
  notasIncompleto: string | null;
  fechaRealizada: string | null;
  clienteServicio: {
    cliente: {
      id: string;
      userId: string | null;
      nombre: string;
      apellido: string | null;
      telefono: string | null;
      direccion: string | null;
      ciudad: string | null;
      sector: { id: string; nombre: string } | null;
    };
    servicio: { id: string; nombre: string; tipo: string };
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
  telefono: string | null;
  ciudad: string | null;
  sector: { id: string; nombre: string } | null;
}

export interface ClientesListResponse {
  items: ClienteListItem[];
  nextCursor: string | null;
}

export interface ClienteStaffDetail extends ClienteListItem {
  email: string | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  notas: string | null;
  metrosCuadrados: number | null;
  servicios: {
    id: string;
    estado: string;
    precio: string;
    frecuenciaMensual: number | null;
    servicio: { id: string; nombre: string; tipo: string };
  }[];
}

// ──────────────────────────────────────────────
// Servicios (admin only)
// ──────────────────────────────────────────────

export interface ServicioListItem {
  id: string;
  nombre: string;
  tipo: "RECURRENTE" | "UNICO";
  descripcion: string | null;
  _count: { clientes: number };
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
