// Lightweight types matching the mobile API JSON responses. Server-side these
// come from Prisma; mobile only needs the read-shape, so we mirror what's used
// in screens. Keep in sync with the includes in
// apps/admin/src/lib/services/visita.service.ts and cliente.service.ts.

import type { EstadoProducto, EstadoVisita, UnidadPeso } from "@vivero/shared";

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
  /**
   * Cuándo llegó la marca al servidor, y si se hizo sin señal. Opcionales
   * porque una copia guardada antes de que existieran no los trae.
   */
  entradaRecibidaEl?: string | null;
  entradaSinConexion?: boolean;
  salidaRecibidaEl?: string | null;
  salidaSinConexion?: boolean;
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

/**
 * "Llegué y no pude hacer la visita", reportado desde el jardín. Una por
 * persona; la ficha las muestra todas y el estado dice "Con novedad" mientras
 * un administrador no la resuelva.
 */
export interface NovedadDeVisita {
  id: string;
  personalId: string;
  personalNombre: string;
  motivo: string;
  nota: string | null;
  /** Las que hagan falta. Opcional porque una copia vieja no lo trae. */
  fotos?: { id: string; url: string }[];
  /** Cuándo se reportó, en ISO. */
  marcadaEl: string;
  sinConexion: boolean;
}

export interface VisitaDetail extends VisitaSummary {
  horaSalida: string | null;
  notas: string | null;
  notasIncompleto: string | null;
  /** Solo en NO_REALIZADA: el motivo de la lista cerrada. */
  motivoNoRealizada?: string | null;
  /** Opcionales: una copia guardada antes de que existieran no los trae. */
  novedades?: NovedadDeVisita[];
  reprogramadaDe?: { id: string; numero: number; fechaProgramada: string } | null;
  reprogramaciones?: { id: string; numero: number; fechaProgramada: string; estado: string }[];
  fechaRealizada: string | null;
  cliente: {
    id: string;
    userId: string | null;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
    telefono: string | null;
  };
  /** Dónde pasa. La dirección y el sector son del lugar, no de la persona. */
  propiedad: PropiedadResumen;
  grupo: { id: string; nombre: string } | null;
  media: VisitaMedia[];
}

/**
 * Un lugar donde se trabaja.
 *
 * La dirección era del cliente y se mudó acá, con el sector y los metros: un
 * cliente con dos casas tiene dos direcciones y ninguna es "la suya".
 */
export interface PropiedadResumen {
  id: string;
  nombre: string;
  ciudad: string | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  notas: string | null;
  lat: number | null;
  lng: number | null;
  m2Total: number | null;
  jardinerasPlantaAlta: boolean;
  numeroArboles: number | null;
  mlVegetacionBaja: number | null;
  mlVegetacionMedia: number | null;
  mlVegetacionAlta: number | null;
  m2Cesped: number | null;
  sector: { id: string; nombre: string } | null;
}

export interface ClienteProfileResponse {
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
    telefono: string | null;
    propiedades: PropiedadResumen[];
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

/** Un plan activo del cliente, tal como lo ofrece el wizard al agendar. */
export interface PlanDelCliente {
  id: string;
  numero: number;
  periodicidad: string;
  visitasPorPeriodo: number;
  /** De qué jardín es: elegir el plan elige la propiedad. */
  propiedad: { id: string; nombre: string };
}

export interface ClienteListItem {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  telefono: string | null;
  /** Marcado como inactivo desde cuándo; `null` = activo. */
  inactivoDesde: string | null;
  propiedades: PropiedadResumen[];
  /** Sus planes activos. */
  suscripciones: PlanDelCliente[];
}

export interface ClientesListResponse {
  items: ClienteListItem[];
  nextCursor: string | null;
}

export interface ClienteStaffDetail extends ClienteListItem {
  empresa: string | null;
  email: string | null;
  notas: string | null;
  /** Desde cuándo es cliente: un instante ISO, el alta de la ficha. */
  createdAt: string;
  /** Sus planes: de qué jardín, cuánto por período y cuántas visitas. */
  suscripciones: {
    id: string;
    numero: number;
    estado: string;
    periodicidad: string;
    fechaInicio: string;
    /** Sin IVA. Llega como texto: es un `Decimal`. */
    precio: string;
    ivaTasa: string;
    visitasPorPeriodo: number;
    propiedad: { id: string; nombre: string };
  }[];
}

// ──────────────────────────────────────────────
// Servicios (admin only)
// ──────────────────────────────────────────────

/**
 * Una fila del catálogo, con lo que la fila muestra.
 *
 * Es el mismo dato que la lista del portal: miniatura, stock, cuántas
 * variantes, estado y categorías. Antes acá llegaban solo el nombre y el tipo,
 * así que las dos listas del mismo catálogo mostraban cosas distintas.
 */
export interface ServicioListItem {
  id: string;
  nombre: string;
  /** Qué es: algo que se ejecuta o algo que se despacha. */
  tipo: "SERVICIO" | "BIEN";
  /** Porcentaje por defecto. En Ecuador conviven 0% y 15%. */
  ivaTasa: string | null;
  descripcion: string | null;
  estado: "ACTIVO" | "BORRADOR";
  /** Fecha en que se archivó, o `null`. Archivado no se ofrece más. */
  archivadoEl: string | null;
  categorias: { id: string; nombre: string }[];
  /** `null` = no cuenta stock, que no es lo mismo que tener cero. */
  stock: number | null;
  variantes: number;
  imagenUrl: string | null;
}

export interface ServiciosListResponse {
  items: ServicioListItem[];
  nextCursor: string | null;
}

/**
 * La ficha de un producto en la app.
 *
 * No extiende la fila de la lista: la ficha trae menos —lo que el detalle del
 * teléfono muestra— y heredar de la lista prometía campos que la respuesta no
 * tiene, que es lo que rompía al agregarle columnas a la lista.
 */
/** Una variante como la manda `GET /api/mobile/servicios/[id]`. */
export interface VarianteDeProducto {
  id: string;
  /** "Rojo · Grande", o el nombre del producto en la variante única. */
  nombre: string;
  /** Qué valor de cada eje: "Color → Rojo". Vacío en la variante única. */
  valores: { opcion: string; valor: string }[];
  sku: string | null;
  /** Precio de lista. Cero es gratis. */
  precio: number;
  cobraIva: boolean;
  /** Costo por unidad. Nulo es "no se sabe". Solo un bien. */
  costo: number | null;
  /** Cuánto pesa una unidad, en `pesoUnidad`. Solo un bien. */
  peso: number | null;
  pesoUnidad: UnidadPeso;
  manejaInventario: boolean;
  stock: number;
  permiteNegativo: boolean;
  /** Cuál de las fotos del producto eligió; `null` es la principal. */
  imagenId: string | null;
  imagenUrl: string | null;
}

/**
 * La ficha entera de un producto: lo mismo que arma la página del portal.
 * Un servicio trae una variante y ningún eje; un bien sin opciones, igual;
 * un bien con opciones, sus ejes y una variante por combinación.
 */
export interface ServicioDetail {
  id: string;
  nombre: string;
  /** Texto plano: el HTML del editor del portal llega aplanado. */
  descripcion: string | null;
  tipo: "SERVICIO" | "BIEN";
  estado: EstadoProducto;
  /** Porcentaje por defecto. En Ecuador conviven 0% y 15%. */
  ivaTasa: number | null;
  createdAt: string;
  categorias: { id: string; nombre: string }[];
  /** Cada fila de la galería, con el archivo de la biblioteca que usa. */
  imagenes: { id: string; mediaId: string; url: string }[];
  opciones: OpcionDeProducto[];
  variantes: VarianteDeProducto[];
}

/** Una categoría en la lista de la app: para elegir con su casilla. */
export interface CategoriaListItem {
  id: string;
  nombre: string;
  /** Cuántos productos vivos tiene. */
  productos: number;
  imagenUrl: string | null;
}

/** Un eje del producto (Color, Tamaño) con sus valores, cada uno con su id. */
export interface OpcionDeProducto {
  id: string;
  nombre: string;
  valores: { id: string; valor: string }[];
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

/** Un grupo con su gente, como lo devuelve la app. */
export interface GrupoConMiembros {
  id: string;
  nombre: string;
  descripcion: string | null;
  /** Cuántas visitas lleva la cuadrilla: lo que distingue una de otra. */
  _count?: { visitas: number };
  miembros: {
    personalId: string;
    personal: {
      id: string;
      nombre: string;
      apellido: string | null;
      tipo: string | null;
    };
  }[];
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

/** La ficha completa de alguien del vivero, con la cuenta con la que entra. */
/** Si entra a la app, y si no, por qué no. Lo calcula el servidor. */
export type EstadoAcceso = "ACTIVO" | "PENDIENTE" | "REVOCADO" | "SIN_CUENTA";

export interface PersonalFicha {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  especialidad: string | null;
  tipo: string | null;
  estado: string;
  /** Las cuadrillas con las que sale habitualmente. */
  grupos?: { grupo: { id: string; nombre: string } }[];
  acceso: EstadoAcceso;
  user: {
    id: string;
    usuario: string | null;
    /** Cuándo se le cortó el acceso. `null` = entra normal. */
    accesoRevocadoEl: string | null;
  } | null;
}

/** Un enlace de acceso recién emitido, como lo devuelve el servidor. */
export interface EnlaceGenerado {
  enlace: string;
  /** ISO. Cuándo deja de servir. */
  expiraEl: string;
  correoEnviado: boolean;
  correoIntentado: boolean;
}

export interface PersonalListResponse {
  items: PersonalOption[];
}

// ──────────────────────────────────────────────
// Órdenes (solo lectura desde la app)
// ──────────────────────────────────────────────

/**
 * Una orden en la lista.
 *
 * `saldo` es el de su factura viva y es lo que dice si entró la plata: el
 * estado de la orden (`CONFIRMADA`, `ANULADA`) es otro eje. `null` significa
 * que nunca se sincronizó con el SRI, que no es lo mismo que cero.
 */
export interface OrdenListItem {
  id: string;
  numero: number;
  fecha: string;
  estado: string;
  cliente: string;
  clienteId: string;
  propiedades: string[];
  lineas: number;
  total: number;
  saldo: number | null;
}

export interface OrdenDetalle {
  id: string;
  numero: number;
  fecha: string;
  estado: string;
  notas: string | null;
  cliente: {
    id: string;
    nombre: string;
    telefono: string | null;
    /** Para proponer a dónde mandarle la factura. */
    email: string | null;
  };
  propiedades: string[];
  visitas: { id: string; numero: number }[];
  suscripcion: { id: string; numero: number } | null;
  lineas: {
    id: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
  }[];
  subtotal: number;
  iva: number;
  total: number;
  factura: {
    id: string;
    numero: string;
    estado: string;
    saldo: number | null;
    fechaEmision: string;
    /** Cuándo se le mandó al cliente por última vez, si se mandó. */
    enviadoEl: string | null;
  } | null;
}

// ──────────────────────────────────────────────
// Suscripciones (admin/staff)
// ──────────────────────────────────────────────

/** Una fila de la lista de planes: lo que la fila muestra y lo que se filtra. */
export interface SuscripcionListItem {
  id: string;
  numero: number;
  estado: string;
  periodicidad: string;
  fechaInicio: string;
  /** Sin IVA. */
  precio: number;
  ivaTasa: number;
  /** Con IVA: lo que el cliente paga por período. */
  totalPeriodo: number;
  visitasPorPeriodo: number;
  cliente: { id: string; nombre: string };
  propiedad: { id: string; nombre: string };
  /** Períodos vencidos que todavía no tienen orden. Con el cron sano, 0. */
  periodosPendientes: number;
}

/** Dónde queda el jardín de un plan: lo que hace falta para escribirlo y llegar. */
export interface PropiedadDelPlan {
  id: string;
  nombre: string;
  ciudad: string | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  sector: { id: string; nombre: string } | null;
}

export interface SuscripcionDetalle {
  id: string;
  numero: number;
  estado: string;
  periodicidad: string;
  fechaInicio: string;
  notas: string | null;
  precio: number;
  ivaTasa: number;
  visitasPorPeriodo: number;
  cliente: { id: string; nombre: string };
  propiedad: PropiedadDelPlan;
  /** Entre cuáles se puede mover el plan: las propiedades vivas del cliente. */
  propiedades: PropiedadDelPlan[];
  visitas: {
    id: string;
    numero: number;
    fechaProgramada: string;
    fechaRealizada: string | null;
    estado: string;
    tareas: string[];
  }[];
  ordenes: {
    id: string;
    numero: number;
    fecha: string;
    estado: string;
    total: number;
    delPlan: number;
    periodoInicio: string | null;
    periodoFin: string | null;
    periodos: number;
    factura: { numero: string; estado: string; saldo: number | null } | null;
  }[];
}

// ──────────────────────────────────────────────
// Emitir y cobrar (admin/staff)
// ──────────────────────────────────────────────

/** Con qué RUC se emite: lo justo para elegir uno. */
export interface EmisorOpcion {
  id: string;
  ruc: string;
  razonSocial: string;
  ambiente: "PRUEBAS" | "PRODUCCION";
  predeterminado: boolean;
}

/** A nombre de quién se le factura a un cliente. */
export interface DatoFacturacionResumen {
  id: string;
  tipoIdentificacion: "CEDULA" | "RUC";
  identificacion: string;
  razonSocial: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  esPredeterminado: boolean;
}

export type FormaDePago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "CHEQUE" | "OTRO";

// ──────────────────────────────────────────────
// Armar una orden (admin/staff)
// ──────────────────────────────────────────────

/** Un producto del catálogo con sus variantes y precios de lista. */
export interface ProductoVendible {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  variantes: {
    id: string;
    /** "Rojo · Grande", o vacío en la variante única. */
    nombre: string;
    sku: string | null;
    precio: number;
    cobraIva: boolean;
    manejaInventario: boolean;
    stock: number;
  }[];
}

/** Un período de plan todavía sin orden. */
export interface PeriodoPendiente {
  suscripcionId: string;
  suscripcionNumero: number;
  propiedad: string;
  descripcion: string;
  precio: number;
  ivaTasa: number;
  periodoInicio: string;
  periodoFin: string;
}
