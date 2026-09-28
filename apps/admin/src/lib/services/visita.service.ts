import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import type {
  EstadoVisita,
  MotivoNovedad,
  Prisma,
} from "@/generated/prisma/client";
import {
  enviarAlertaVisitaCompletada,
  enviarAlertaVisitaIncompleta,
  enviarConfirmacionVisita,
} from "@/lib/whatsapp/service";
import {
  pushAlertaCompletada,
  pushAlertaIncompleta,
  pushConfirmacionVisita,
  pushNovedadDeVisita,
  pushPedirCalificacion,
  pushVisitaNoRealizada,
} from "@/lib/push/triggers";
import { visitaCerrada } from "@vivero/shared";
import { getUploadUrl, publicUrlForKey } from "@/lib/s3";
import { TAREAS_DE_VISITA_INCLUDE, nombrePersonal } from "@/lib/visita-tareas";
import { hoyISOEcuador } from "@/lib/fechas";
import { randomUUID } from "crypto";

/**
 * Una visita: quién va, a dónde y qué día.
 *
 * **No lleva plata y ya no lleva productos.** Lo que se hace en ella son
 * tareas, que carga cada jardinero al terminar marcándolas de un catálogo
 * cerrado (ver `tarea.service.ts`). Antes la visita llevaba productos del
 * catálogo y de ahí salía un borrador de orden al completarla; eso se terminó,
 * porque una tarea no tiene precio. Cobrar es armar una orden, y esa orden
 * puede decir de qué visitas es (`OrdenVisita`) sin que ninguna línea venga de
 * un renglón de la visita.
 *
 * **Cerrarla es de oficina.** Cada asignado registra *lo suyo* —sus horas y sus
 * tareas—, la visita pasa sola a `EN_CURSO` con el primer registro, y un
 * `ADMIN`/`STAFF` la da por `COMPLETADA`, `INCOMPLETA` o `NO_REALIZADA`
 * mirando lo que cargaron. No se cierra sola al registrar el último: puede
 * faltar alguien que nunca cargue, y la oficina es quien decide si eso igual
 * está terminado.
 *
 * **Y cuando no se pudo hacer, el jardinero lo reporta.** Llegar y que no haya
 * nadie, o que el cliente la cancele en la puerta, no tenía camino honesto: la
 * salida exige una tarea, cancelar es del cliente o de la oficina, y lo que
 * quedaba era el chat. `reportarNovedad` lo anota con la evidencia de una
 * marca, le avisa a la oficina en el momento —que es cuando todavía se puede
 * llamar al cliente con la cuadrilla cerca— y la oficina lo resuelve:
 * reprogramar, cancelar, o cerrarla como `NO_REALIZADA`, que es el viaje en
 * falso y se puede cobrar.
 */

// ──────────────────────────────────────────────
// Quién ve qué
// ──────────────────────────────────────────────

/** Lo mínimo para decidir si alguien puede ver una visita. */
interface VisitaParaPermiso {
  cliente: { userId: string | null };
  personal: { personalId: string }[];
}

/**
 * `ADMIN`/`STAFF` ven todo; el cliente, lo suyo; el jardinero, **solo las
 * visitas donde está asignado**.
 *
 * Antes el jardinero no veía ninguna —reportaba su capataz— y el capataz veía
 * las de sus sectores. Con una cuenta por persona, el corte es la asignación:
 * es la misma lista que tiene que abrir para cargar lo que hizo.
 */
function ensureViewerCanSeeVisita(
  viewer: Viewer,
  visita: VisitaParaPermiso,
): void {
  if (isAdminRole(viewer.role)) return;
  if (viewer.role === "CLIENTE") {
    if (visita.cliente.userId === viewer.id) return;
    throw new ForbiddenError();
  }
  if (viewer.role === "PERSONAL") {
    if (
      viewer.personalId &&
      visita.personal.some((p) => p.personalId === viewer.personalId)
    ) {
      return;
    }
    throw new ForbiddenError();
  }
  throw new ForbiddenError();
}

function ensureOficina(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

const VISITA_DETAIL_INCLUDE = {
  cliente: {
    select: {
      id: true,
      userId: true,
      nombre: true,
      apellido: true,
      empresa: true,
      telefono: true,
    },
  },
  // Dónde pasa: la dirección y el sector son del lugar, no de la persona, y
  // es lo que el jardinero necesita para llegar.
  propiedad: {
    select: {
      id: true,
      nombre: true,
      ciudad: true,
      direccion: true,
      numeroCasa: true,
      referencia: true,
      notas: true,
      lat: true,
      lng: true,
      m2Total: true,
      jardinerasPlantaAlta: true,
      numeroArboles: true,
      mlVegetacionBaja: true,
      mlVegetacionMedia: true,
      mlVegetacionAlta: true,
      m2Cesped: true,
      sector: { select: { id: true, nombre: true } },
    },
  },
  ...TAREAS_DE_VISITA_INCLUDE,
  grupo: { select: { id: true, nombre: true } },
  // De qué plan es, si es de alguno: la ficha lo muestra con un link.
  suscripcion: {
    select: { id: true, numero: true, periodicidad: true, estado: true },
  },
  media: { orderBy: { createdAt: "asc" } },
  // Lo que alguien reportó desde el jardín: "llegué y no pude". La ficha lo
  // muestra arriba de todo y es lo que un administrador resuelve.
  novedades: {
    orderBy: { marcadaEl: "asc" },
    select: {
      id: true,
      personalId: true,
      personalNombre: true,
      motivo: true,
      nota: true,
      fotos: { select: { id: true, url: true }, orderBy: { createdAt: "asc" } },
      marcadaEl: true,
      recibidaEl: true,
      sinConexion: true,
      lat: true,
      lng: true,
      precision: true,
      simulada: true,
      dispositivo: true,
    },
  },
  // De qué visita fallida es la repetición, y con cuál se repitió esta: el
  // par de enlaces que deja ir de una a la otra.
  reprogramadaDe: {
    select: { id: true, numero: true, fechaProgramada: true, estado: true },
  },
  reprogramaciones: {
    where: { deletedAt: null },
    select: { id: true, numero: true, fechaProgramada: true, estado: true },
  },
} as const;

export async function getVisitaForViewer(visitaId: string, viewer: Viewer) {
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    include: VISITA_DETAIL_INCLUDE,
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");
  ensureViewerCanSeeVisita(viewer, visita);
  return {
    ...visita,
    media: fotosQueLeTocan(visita.media, viewer),
    novedades: novedadesQueLeTocan(visita.novedades, viewer),
  };
}

/**
 * Qué novedades de la visita le corresponden a quien mira: la misma regla
 * que las fotos. El jardinero ve **la suya**; lo que reportó un compañero es
 * de ese compañero y de la oficina, que es quien lo resuelve. La oficina y el
 * cliente las ven todas.
 */
function novedadesQueLeTocan<T extends { personalId: string }>(
  novedades: T[],
  viewer: Viewer,
): T[] {
  if (viewer.role !== "PERSONAL") return novedades;
  return novedades.filter((n) => n.personalId === viewer.personalId);
}

/**
 * Qué fotos de la visita le corresponden a quien mira.
 *
 * El jardinero ve **las suyas**. En una visita de tres, la grilla mezclaba el
 * trabajo de todos y cualquiera podía borrar la foto que otro acababa de sacar;
 * además, la de al lado no le sirve para nada —él sube lo que él vio—.
 *
 * La oficina las ve todas, porque es la que arma el informe, y el cliente
 * también, porque son de su jardín. Las que no tienen dueño —subidas antes de
 * que existiera la columna— quedan fuera de la vista del jardinero: no sabemos
 * si son suyas, y mostrárselas sería dejarle borrar algo que quizá no subió.
 */
function fotosQueLeTocan<T extends { subidaPorId: string | null }>(
  media: T[],
  viewer: Viewer,
): T[] {
  if (viewer.role !== "PERSONAL") return media;
  return media.filter((m) => m.subidaPorId === viewer.id);
}

export interface ListVisitasFilters {
  from?: Date;
  to?: Date;
  estado?: EstadoVisita;
  clienteId?: string;
  /** Visitas donde **alguien hizo** esta tarea. */
  tareaId?: string;
  cursor?: string;
  limit?: number;
  defaultFromToday?: boolean;
}

function whereParaViewer(viewer: Viewer): Prisma.VisitaWhereInput {
  if (isAdminRole(viewer.role)) return { deletedAt: null };
  if (viewer.role === "PERSONAL") {
    if (!viewer.personalId) throw new ForbiddenError();
    return {
      deletedAt: null,
      personal: { some: { personalId: viewer.personalId, removedAt: null } },
    };
  }
  if (viewer.role === "CLIENTE") {
    if (!viewer.clienteId) throw new ForbiddenError();
    return { deletedAt: null, clienteId: viewer.clienteId };
  }
  throw new ForbiddenError();
}

export async function listVisitas(
  viewer: Viewer,
  filters: ListVisitasFilters = {},
) {
  const where = whereParaViewer(viewer);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

  const fechaProgramada: { gte?: Date; lte?: Date } = {};
  if (filters.from) {
    fechaProgramada.gte = filters.from;
  } else if (filters.defaultFromToday) {
    fechaProgramada.gte = startOfToday();
  }
  if (filters.to) fechaProgramada.lte = filters.to;
  if (Object.keys(fechaProgramada).length > 0) {
    where.fechaProgramada = fechaProgramada;
  }

  if (filters.estado) where.estado = filters.estado;
  if (filters.clienteId) where.clienteId = filters.clienteId;
  // "Las visitas donde se podó" es dónde **alguien** cargó esa tarea, no dónde
  // se exigía: lo que se busca es trabajo hecho.
  if (filters.tareaId) {
    where.personal = {
      some: { removedAt: null, tareas: { some: { tareaId: filters.tareaId } } },
    };
  }

  const visitas = await prisma.visita.findMany({
    where,
    include: VISITA_DETAIL_INCLUDE,
    orderBy: [{ fechaProgramada: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = visitas.length > limit;
  const items = (hasMore ? visitas.slice(0, limit) : visitas).map((v) => ({
    ...v,
    novedades: novedadesQueLeTocan(v.novedades, viewer),
  }));
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ──────────────────────────────────────────────
// Archivos
// ──────────────────────────────────────────────

export interface VisitaMediaInput {
  key: string;
  tipo: "imagen" | "video";
  /**
   * A qué tarea corresponde la foto. Opcional, pero es lo que hace que el
   * informe se arme solo, así que se pide al subir: desde el teléfono, entre
   * las tareas que esa persona acaba de marcar.
   */
  tareaId?: string | null;
}

export interface RequestUploadFile {
  fileName: string;
  contentType: string;
}

export interface UploadDescriptor {
  key: string;
  uploadUrl: string;
  tipo: "imagen" | "video";
  contentType: string;
}

/**
 * Subir y etiquetar fotos lo puede hacer quien estuvo en el jardín.
 *
 * Es el jardinero el que saca las fotos mientras trabaja, así que el permiso es
 * el mismo que para ver la visita: si la ve, es porque está asignado.
 */
async function ensurePuedeTocarArchivos(visitaId: string, viewer: Viewer) {
  if (viewer.role === "CLIENTE") throw new ForbiddenError();
  await getVisitaForViewer(visitaId, viewer);
}

export async function removeVisitaMedia(
  visitaId: string,
  mediaId: string,
  viewer: Viewer,
) {
  await removeVisitaMediaMuchas(visitaId, [mediaId], viewer);
}

/**
 * Borra varias de una vez.
 *
 * Una llamada por foto significaba que borrar cinco eran cinco viajes, cinco
 * oportunidades de que uno falle y ninguna forma de arrepentirse a mitad de
 * camino. Acá se manda la lista y se aplica entera o no se aplica.
 *
 * Un jardinero solo borra **las suyas**: la foto que sacó su compañero no es
 * suya para tirarla. La oficina borra cualquiera.
 */
export async function removeVisitaMediaMuchas(
  visitaId: string,
  mediaIds: string[],
  viewer: Viewer,
) {
  await ensurePuedeTocarArchivos(visitaId, viewer);
  if (mediaIds.length === 0) return;

  const suyas = await prisma.visitaMedia.findMany({
    where: {
      id: { in: mediaIds },
      visitaId,
      ...(viewer.role === "PERSONAL" ? { subidaPorId: viewer.id } : {}),
    },
    select: { id: true },
  });
  if (suyas.length !== mediaIds.length) {
    throw new NotFoundError(
      "Alguno de los archivos no existe o no lo subiste tú.",
    );
  }

  await prisma.visitaMedia.deleteMany({ where: { id: { in: mediaIds } } });
}

/**
 * Cambiar a qué tarea corresponde un archivo.
 *
 * **Cualquier tarea viva, no solo las que se hicieron en la visita.** En el
 * campo se fotografía lo que aparece —un problema de riego durante una poda— y
 * exigir que la etiqueta saliera de lo cargado dejaba esas fotos sin clasificar.
 * El informe arma secciones con cualquier tarea.
 */
/**
 * Reetiquetar varias de una, dentro del mismo guardado.
 *
 * La pantalla junta agregar, quitar y reetiquetar en un solo *Guardar*, así que
 * esto tiene que viajar con lo demás: una foto que cambió de tarea y una que se
 * borró son el mismo gesto, y partirlo en dos llamadas deja la mitad aplicada
 * cuando la segunda falla.
 *
 * Cobra las mismas reglas que de a una: el jardinero solo toca lo suyo y la
 * tarea tiene que existir. Acá `tareaId` **no** puede ser `null` —quitarle la
 * etiqueta a una foto no es algo que la pantalla ofrezca—, a diferencia del
 * `PATCH` suelto, que sí lo acepta porque las fotos viejas vienen sin ninguna.
 */
export async function etiquetarVisitaMediaMuchas(
  visitaId: string,
  cambios: { id: string; tareaId: string }[],
  viewer: Viewer,
) {
  await ensurePuedeTocarArchivos(visitaId, viewer);
  if (cambios.length === 0) return;

  const ids = [...new Set(cambios.map((c) => c.id))];
  const suyas = await prisma.visitaMedia.findMany({
    where: {
      id: { in: ids },
      visitaId,
      ...(viewer.role === "PERSONAL" ? { subidaPorId: viewer.id } : {}),
    },
    select: { id: true },
  });
  if (suyas.length !== ids.length) {
    throw new NotFoundError(
      "Alguno de los archivos no existe o no lo subiste tú.",
    );
  }

  const tareaIds = [...new Set(cambios.map((c) => c.tareaId))];
  const vivas = await prisma.tarea.count({
    where: { id: { in: tareaIds }, deletedAt: null },
  });
  if (vivas !== tareaIds.length) {
    throw new ValidationError("Alguna de las tareas ya no existe.");
  }

  await prisma.$transaction(
    cambios.map((c) =>
      prisma.visitaMedia.update({
        where: { id: c.id },
        data: { tareaId: c.tareaId },
      }),
    ),
  );
}

export async function etiquetarVisitaMedia(
  visitaId: string,
  mediaId: string,
  tareaId: string | null,
  viewer: Viewer,
) {
  await ensurePuedeTocarArchivos(visitaId, viewer);

  const media = await prisma.visitaMedia.findFirst({
    where: {
      id: mediaId,
      visitaId,
      // Un jardinero etiqueta lo suyo. Reetiquetar la foto de otro es
      // cambiarle a dónde va en el informe.
      ...(viewer.role === "PERSONAL" ? { subidaPorId: viewer.id } : {}),
    },
    select: { id: true },
  });
  if (!media) throw new NotFoundError("Archivo no encontrado");

  if (tareaId) {
    const tarea = await prisma.tarea.findFirst({
      where: { id: tareaId, deletedAt: null },
      select: { id: true },
    });
    if (!tarea) throw new ValidationError("Esa tarea no existe");
  }

  return prisma.visitaMedia.update({
    where: { id: mediaId },
    data: { tareaId },
    select: { id: true, tareaId: true },
  });
}

export async function requestVisitaMediaUploads(
  visitaId: string,
  viewer: Viewer,
  files: RequestUploadFile[],
): Promise<UploadDescriptor[]> {
  await ensurePuedeTocarArchivos(visitaId, viewer);

  return Promise.all(
    files.map(async (f) => {
      const ext = f.fileName.includes(".")
        ? f.fileName.slice(f.fileName.lastIndexOf("."))
        : "";
      const key = `visitas/${visitaId}/${randomUUID()}${ext}`;
      const uploadUrl = await getUploadUrl(key, f.contentType);
      return {
        key,
        uploadUrl,
        tipo: f.contentType.startsWith("video/")
          ? ("video" as const)
          : ("imagen" as const),
        contentType: f.contentType,
      };
    }),
  );
}

export async function addVisitaMedia(
  visitaId: string,
  viewer: Viewer,
  media: VisitaMediaInput[],
) {
  await ensurePuedeTocarArchivos(visitaId, viewer);
  // Con la lista vacía igual devuelve lo que hay: se lo llama también cuando la
  // tanda era solo borrar, y responder `[]` ahí le diría a la pantalla que la
  // visita se quedó sin fotos.
  //
  // Una clave que ya está en la visita no se agrega dos veces: la app manda
  // la tanda de nuevo cuando la conexión se cortó sin respuesta, con las
  // mismas claves, y eso es la misma tanda y no otra.
  const yaEstan = new Set(
    (
      await prisma.visitaMedia.findMany({
        where: { visitaId, key: { in: media.map((m) => m.key) } },
        select: { key: true },
      })
    ).map((m) => m.key),
  );
  const nuevas = media.filter((m) => !yaEstan.has(m.key));
  if (nuevas.length > 0) {
    await prisma.visitaMedia.createMany({
      data: nuevas.map((m) => ({
        visitaId,
        key: m.key,
        url: publicUrlForKey(m.key),
        tipo: m.tipo,
        tareaId: m.tareaId ?? null,
        subidaPorId: viewer.id,
      })),
    });
  }
  const todas = await prisma.visitaMedia.findMany({
    where: { visitaId },
    orderBy: { createdAt: "asc" },
  });
  return fotosQueLeTocan(todas, viewer);
}

// ──────────────────────────────────────────────
// El parte de cada uno
// ──────────────────────────────────────────────

/**
 * Dónde estaba quien marcó. Lo que da el dispositivo, sin interpretar.
 *
 * `precision` es el radio en metros que el propio dispositivo informa, y
 * `simulada` sale de Android cuando la ubicación viene de una app de mock —
 * iOS no lo dice, así que ahí es `null`, que no significa "no simulada" sino
 * "no sabemos".
 */
export interface UbicacionDeMarca {
  lat: number;
  lng: number;
  precision?: number | null;
  simulada?: boolean | null;
}

/** Lo que acompaña a una marca además de la hora. */
export interface ContextoDeMarca {
  ubicacion?: UbicacionDeMarca;
  /** Identificador de la instalación de la app. Ver `entradaDispositivo`. */
  dispositivo?: string | null;
  /**
   * Cuándo se apretó el botón, según el teléfono. Sin esto la marca es
   * **ahora**; con esto es la hora del teléfono, y se anota aparte cuándo
   * llegó. Ver `entradaRecibidaEl` en el esquema.
   */
  marcadaEl?: string | Date | null;
  /** El teléfono la marcó sin señal y la mandó después. */
  sinConexion?: boolean | null;
}

/** Con cuánto se tolera que el reloj del teléfono vaya adelantado. */
const TOLERANCIA_DE_RELOJ_MS = 5 * 60 * 1000;
/** Una marca más vieja que esto no llega tarde: se inventó. */
const MAXIMO_ATRASO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * El instante de una marca: el que mandó el teléfono, o ahora.
 *
 * Del teléfono se acepta lo razonable: no del futuro —salvo unos minutos de
 * reloj adelantado— y no de hace más de una semana. Lo demás lo decide el
 * día de la visita, que se controla contra este instante y no contra hoy.
 */
function instanteDeMarca(opciones: ContextoDeMarca): Date {
  if (!opciones.marcadaEl) return new Date();
  const instante = new Date(opciones.marcadaEl);
  if (Number.isNaN(instante.getTime())) {
    throw new ValidationError("La hora de la marca no se entiende.");
  }
  const ahora = Date.now();
  if (instante.getTime() > ahora + TOLERANCIA_DE_RELOJ_MS) {
    throw new ValidationError("La hora de la marca está en el futuro. Revisa el reloj del teléfono.");
  }
  if (instante.getTime() < ahora - MAXIMO_ATRASO_MS) {
    throw new ValidationError("La marca es de hace más de una semana.");
  }
  return instante;
}

/**
 * Un reintento trae la misma marca: el teléfono la mandó, la conexión se
 * cortó sin respuesta y la vuelve a mandar con la misma hora. Es la misma,
 * no una segunda; se contesta como si hubiera entrado recién.
 */
function esLaMismaMarca(guardada: Date | null, opciones: ContextoDeMarca): boolean {
  if (!guardada || !opciones.marcadaEl) return false;
  return Math.abs(guardada.getTime() - new Date(opciones.marcadaEl).getTime()) < 1000;
}

export interface ParteDeVisitaPayload {
  /**
   * De quién es el parte. Solo la oficina puede mandarlo: un jardinero carga lo
   * suyo y nada más, así que para él este campo se ignora.
   */
  personalId?: string;
  /** Corrección de los instantes marcados. ISO o `Date`. */
  entradaEl?: string | Date | null;
  salidaEl?: string | Date | null;
  /** Las tareas que **esta persona** hizo. Reemplaza a las que tuviera. */
  tareaIds: string[];
  /** Fotos que trae del jardín, si las carga en el mismo gesto. */
  media?: VisitaMediaInput[];
}

/**
 * Las horas de la visita salen de las de su gente.
 *
 * La primera entrada y la última salida de los que marcaron: es la ventana en
 * que hubo alguien en el jardín, que es lo que el cliente y las notificaciones
 * quieren decir por "de tal a tal hora".
 *
 * Mira `entradaEl`/`salidaEl` y no `registradoEl`: alguien que marcó entrada y
 * todavía está trabajando ya corrió la ventana, aunque su parte no esté
 * cargado. Antes eran textos `HH:MM` que ordenaban solos; ahora son instantes,
 * que además ordenan bien cruzando la medianoche.
 */
async function recalcularHorasDeVisita(
  tx: Prisma.TransactionClient,
  visitaId: string,
) {
  const partes = await tx.visitaPersonal.findMany({
    where: { visitaId, removedAt: null },
    select: { entradaEl: true, salidaEl: true },
  });
  const entradas = partes
    .map((p) => p.entradaEl)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const salidas = partes
    .map((p) => p.salidaEl)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  await tx.visita.update({
    where: { id: visitaId },
    data: {
      horaEntrada: entradas.length ? horaDe(entradas[0]) : null,
      horaSalida: salidas.length ? horaDe(salidas.at(-1)!) : null,
    },
  });
}

/**
 * La hora de un instante, como la escribiría alguien: `"08:15"`.
 *
 * En la zona del servidor, que es la del vivero: `Visita.horaEntrada` existe
 * para que las listas y las notificaciones digan una hora sin tener que
 * formatearla cada vez.
 */
export function horaDe(fecha: Date): string {
  return fecha.toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ZONA,
  });
}

/** La zona en que trabaja el vivero. Ecuador no tiene horario de verano. */
const ZONA = "America/Guayaquil";

/** Una fecha que puede venir como ISO, como `Date`, o no venir. */
function aFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new ValidationError("Esa fecha no se entiende.");
  }
  return fecha;
}

/**
 * Cuál de los partes es el de quien pide, y si tiene derecho a tocarlo.
 *
 * El jardinero carga lo suyo; la oficina puede cargar por otro para corregir.
 * Es la misma pregunta en las tres funciones del parte, y hacerla en tres
 * lugares es como empiezan a contestarla distinto.
 */
async function miAsignacion(
  visitaId: string,
  viewer: Viewer,
  personalIdPedido?: string,
) {
  const visita = await getVisitaForViewer(visitaId, viewer);
  ensureHuboOPuedeHaberTrabajo(visita.estado);

  let personalId: string;
  if (isAdminRole(viewer.role)) {
    if (!personalIdPedido) {
      throw new ValidationError("Falta decir de quién es el parte.");
    }
    personalId = personalIdPedido;
  } else if (viewer.role === "PERSONAL") {
    if (!viewer.personalId) throw new ForbiddenError();
    personalId = viewer.personalId;
  } else {
    throw new ForbiddenError();
  }

  const asignacion = visita.personal.find((p) => p.personalId === personalId);
  if (!asignacion) {
    throw new ValidationError("Esa persona no está asignada a esta visita.");
  }
  return { visita, asignacion };
}

/**
 * En una cancelada o una no realizada no hay parte que cargar ni corregir: la
 * primera no pasó, y la segunda se cerró diciendo que nadie trabajó. Las otras
 * dos formas de cerrar (completada, incompleta) sí dejan corregir un parte,
 * porque ahí hubo trabajo y el parte es su registro.
 */
function ensureHuboOPuedeHaberTrabajo(estado: EstadoVisita) {
  if (estado === "CANCELADA") {
    throw new ConflictError("Esta visita está cancelada.");
  }
  if (estado === "NO_REALIZADA") {
    throw new ConflictError("Esta visita se cerró como no realizada.");
  }
}

/** Lo que rodea a una marca —dónde y desde qué aparato—, listo para escribir. */
function columnasDeContexto(
  cual: "entrada" | "salida",
  contexto: ContextoDeMarca,
) {
  const { ubicacion, dispositivo } = contexto;
  return {
    ...(ubicacion
      ? {
          [`${cual}Lat`]: ubicacion.lat,
          [`${cual}Lng`]: ubicacion.lng,
          [`${cual}Precision`]: ubicacion.precision ?? null,
          [`${cual}Simulada`]: ubicacion.simulada ?? null,
        }
      : {}),
    [`${cual}Dispositivo`]: dispositivo ?? null,
  };
}

/**
 * Marcar es del teléfono, y solo de quien marca.
 *
 * Marcar significa "estuve acá a esta hora", y eso vale lo que valga la
 * ubicación que lo acompaña. En el navegador esa ubicación **se falsea en tres
 * clics** —las DevTools de Chrome traen un override, sin instalar nada— así que
 * una marca hecha desde la web no dice nada que no diga escribir la hora a
 * mano, y encima parece que sí. En el teléfono el permiso se pide en serio, la
 * lectura es mucho mejor y Android delata las de mock (`simulada`).
 *
 * Así que la ruta web se fue y esto solo acepta al asignado: la oficina no
 * marca por nadie. Cuando a alguien se le murió el teléfono, lo que la oficina
 * hace es **corregir** el instante con `registrarParte`, que es otra cosa y se
 * llama distinto — "me dijo que estuvo de 8 a 12" no es lo mismo que una marca.
 */
function ensureQuienMarca(viewer: Viewer) {
  if (viewer.role !== "PERSONAL") {
    throw new ForbiddenError(
      "Marcar y reportar es de quien hace la visita, desde la app.",
    );
  }
}

/**
 * La entrada se marca **el día de la visita**.
 *
 * La pantalla ya no ofrece el botón fuera de ese día, y eso no alcanza: la app
 * puede llevar horas abierta mostrando la visita de ayer, y la ruta acepta
 * cualquier POST venga de donde venga. Sin esto, marcar la entrada de una
 * visita de la semana pasada es una llamada.
 *
 * El día es el de **Ecuador**, no el del servidor, que corre en UTC: entre las
 * 19:00 y la medianoche de Guayaquil en UTC ya es mañana, y una marca de las
 * 19:30 se rechazaría sola.
 *
 * La salida **no** se controla así, a propósito: exige una entrada —que ya
 * pasó por acá— y un trabajo que termina a las 00:20 es uno que empezó ayer.
 * Quien no marcó el día que correspondía no marca después: eso lo corrige la
 * oficina con `registrarParte`, que es otra cosa y se llama distinto.
 */
function ensureEsElDiaDeLaVisita(
  fechaProgramada: Date,
  instante: Date,
  que = "La entrada se marca",
) {
  // Contra el instante de la marca y no contra hoy: una entrada hecha sin
  // señal el día de la visita puede llegar recién al día siguiente.
  if (fechaProgramada.toISOString().slice(0, 10) !== hoyISOEcuador(instante)) {
    throw new ConflictError(`${que} el día de la visita.`);
  }
}

/** `@db.Date` vuelve como medianoche UTC: su ISO recortado es el día guardado. */
function esElDiaDeHoy(fechaDeCalendario: Date): boolean {
  return fechaDeCalendario.toISOString().slice(0, 10) === hoyISOEcuador();
}

/**
 * Un **instante** cae hoy si cae hoy en Ecuador.
 *
 * No es lo mismo que lo de arriba y confundirlos es fácil: una salida marcada a
 * las 20:00 de Guayaquil es la 01:00 UTC del día siguiente, y recortar su ISO
 * daría mañana.
 */
function esInstanteDeHoy(instante: Date): boolean {
  return hoyISOEcuador(instante) === hoyISOEcuador();
}

/**
 * Las tareas se corrigen **el día de la visita**, no para siempre.
 *
 * Un parte es lo que alguien dice haber hecho ese día, y dejarlo abierto para
 * siempre lo convierte en algo que se acomoda después —cuando la oficina
 * pregunta, cuando el informe ya salió—. Las fotos sí quedan abiertas: son de
 * lo que se vio en el jardín, y agregar una el martes no cambia lo que se hizo
 * el lunes.
 *
 * Vale también **el día en que marcó su salida**: quien entró a las 23:50 y
 * salió a las 00:30 cargó sus tareas recién ahí, y no poder destildar una a los
 * cinco minutos sería castigarlo por el horario.
 *
 * Solo para quien carga lo suyo. La oficina corrige cualquier día: es la que
 * arregla lo que quedó mal, y para eso no puede tener la puerta cerrada.
 */
function ensureSePuedeCorregir(
  fechaProgramada: Date,
  salidaEl: Date | null,
) {
  if (esElDiaDeHoy(fechaProgramada)) return;
  if (salidaEl && esInstanteDeHoy(salidaEl)) return;
  throw new ConflictError(
    "Las tareas se corrigen el día de la visita. Las fotos no tienen límite.",
  );
}

/**
 * Marca la entrada: sella el momento y guarda dónde estaba.
 *
 * El momento es **ahora**, no una hora que alguien escribe: eso es lo que
 * convierte el dato en algo que significa "estuvo ahí a esa hora" en vez de
 * "alguien dijo que estuvo".
 *
 * La ubicación es opcional a propósito. Falta señal adentro de una pared, con
 * la batería baja o con el teléfono en la camioneta, y negarse a registrar por
 * eso deja a alguien sin poder anotar el trabajo que sí hizo: se pierde el dato
 * real por perseguir uno falso. La oficina ve cuáles marcas vinieron sin
 * ubicación, que es la pregunta que se quería responder.
 *
 * No se vuelve a marcar: una entrada marcada dos veces reescribiría la primera,
 * y la primera es la que dice cuándo llegó. Corregirla es de oficina.
 */
export async function marcarEntrada(
  visitaId: string,
  viewer: Viewer,
  opciones: ContextoDeMarca = {},
) {
  ensureQuienMarca(viewer);
  const { visita, asignacion } = await miAsignacion(visitaId, viewer);
  if (asignacion.entradaEl) {
    if (esLaMismaMarca(asignacion.entradaEl, opciones)) {
      return getVisitaForViewer(visitaId, viewer);
    }
    throw new ConflictError("Ya marcaste tu entrada en esta visita.");
  }
  const instante = instanteDeMarca(opciones);
  ensureEsElDiaDeLaVisita(visita.fechaProgramada, instante);

  await prisma.$transaction(async (tx) => {
    await tx.visitaPersonal.update({
      where: { id: asignacion.id },
      data: {
        entradaEl: instante,
        entradaRecibidaEl: new Date(),
        entradaSinConexion: Boolean(opciones.sinConexion),
        ...columnasDeContexto("entrada", opciones),
      },
    });
    await recalcularHorasDeVisita(tx, visitaId);
    // La primera entrada la pone en curso: alguien está en el jardín. Si ya
    // estaba cerrada no se reabre — que llegue un marcado tarde no deshace la
    // decisión de la oficina.
    if (visita.estado === "PROGRAMADA") {
      await tx.visita.update({
        where: { id: visitaId },
        data: { estado: "EN_CURSO" },
      });
    }
  });

  return getVisitaForViewer(visitaId, viewer);
}

/**
 * Marca la salida, y con ella lo que hizo.
 *
 * Es el momento en que se pregunta qué tareas hizo: recién ahí las sabe, y
 * preguntárselo al llegar sería pedirle que adivine. Las fotos pueden ir acá o
 * haberse subido antes — se suben en cualquier momento, porque se sacan
 * mientras se trabaja.
 *
 * Exige haber marcado entrada: una salida sin entrada no dice nada. Quien se
 * olvidó marca las dos seguidas, y los instantes dicen la verdad de lo que el
 * sistema sabe — cuándo se apretó el botón.
 */
export async function marcarSalida(
  visitaId: string,
  viewer: Viewer,
  payload: ContextoDeMarca & {
    tareaIds: string[];
    media?: VisitaMediaInput[];
  },
) {
  ensureQuienMarca(viewer);
  const { asignacion } = await miAsignacion(visitaId, viewer);
  if (!asignacion.entradaEl) {
    throw new ConflictError("Primero marca tu entrada.");
  }
  if (asignacion.salidaEl) {
    if (esLaMismaMarca(asignacion.salidaEl, payload)) {
      return getVisitaForViewer(visitaId, viewer);
    }
    throw new ConflictError("Ya marcaste tu salida en esta visita.");
  }
  const instante = instanteDeMarca(payload);
  if (instante.getTime() < asignacion.entradaEl.getTime()) {
    throw new ValidationError("La salida no puede ser antes de la entrada.");
  }

  const tareaIds = await tareasVivas(payload.tareaIds);
  ensureAlMenosUnaTarea(tareaIds);

  await prisma.$transaction(async (tx) => {
    await tx.visitaPersonalTarea.deleteMany({
      where: { visitaPersonalId: asignacion.id },
    });
    if (tareaIds.length > 0) {
      await tx.visitaPersonalTarea.createMany({
        data: tareaIds.map((tareaId) => ({
          visitaPersonalId: asignacion.id,
          tareaId,
        })),
      });
    }
    await tx.visitaPersonal.update({
      where: { id: asignacion.id },
      data: {
        salidaEl: instante,
        salidaRecibidaEl: new Date(),
        salidaSinConexion: Boolean(payload.sinConexion),
        ...columnasDeContexto("salida", payload),
        registradoEl: new Date(),
      },
    });
    if (payload.media?.length) {
      await tx.visitaMedia.createMany({
        data: payload.media.map((m) => ({
          visitaId,
          key: m.key,
          url: publicUrlForKey(m.key),
          tipo: m.tipo,
          tareaId: m.tareaId ?? null,
        })),
      });
    }
    await recalcularHorasDeVisita(tx, visitaId);
  });

  return getVisitaForViewer(visitaId, viewer);
}

export interface NovedadPayload extends ContextoDeMarca {
  motivo: MotivoNovedad;
  nota?: string | null;
  /** Ya subidas a R2 bajo `novedades/<visitaId>/`. */
  fotos?: { key: string }[];
}

/**
 * "Llegué y no pude hacer la visita." Lo dice el asignado, desde la app, y
 * viaja con la misma evidencia que una marca: el instante, dónde estaba y
 * desde qué aparato. Es lo que se le contesta al cliente que dice que nunca
 * fueron: estuvimos a las 8:12, en este punto, y nadie abrió.
 *
 * **No cierra la visita.** Queda anotada, la oficina recibe el aviso en el
 * momento —con la cuadrilla todavía cerca, que es cuando llamar al cliente
 * sirve— y decide: reprogramar, cancelar, o cerrarla como no realizada.
 *
 * Se acepta con o sin entrada marcada. Con entrada y sin salida —entró y lo
 * mandaron de vuelta a los diez minutos— la novedad **es también su salida**:
 * le cierra las horas sin exigirle la tarea que no hizo, que es exactamente lo
 * que la salida normal exige y lo que no tenía cómo contestar. Después de la
 * salida ya no: su parte está cargado, y lo que haya que decir va al chat.
 *
 * Una por persona y por visita: dos de la misma cuadrilla pueden reportar, y
 * un reintento sin señal trae el mismo `marcadaEl` y se contesta como si
 * hubiera entrado recién, igual que una marca.
 */
export async function reportarNovedad(
  visitaId: string,
  viewer: Viewer,
  payload: NovedadPayload,
) {
  ensureQuienMarca(viewer);
  const { visita, asignacion } = await miAsignacion(visitaId, viewer);
  if (visitaCerrada(visita.estado)) {
    throw new ConflictError("Esta visita ya está cerrada.");
  }
  const previa = visita.novedades.find(
    (n) => n.personalId === asignacion.personalId,
  );
  if (previa) {
    if (esLaMismaMarca(previa.marcadaEl, payload)) {
      return getVisitaForViewer(visitaId, viewer);
    }
    throw new ConflictError("Ya reportaste una novedad en esta visita.");
  }
  if (asignacion.salidaEl) {
    throw new ConflictError(
      "Ya marcaste tu salida en esta visita. Lo que haya que contar va al chat.",
    );
  }
  const instante = instanteDeMarca(payload);
  ensureEsElDiaDeLaVisita(
    visita.fechaProgramada,
    instante,
    "La novedad se reporta",
  );
  if (asignacion.entradaEl && instante.getTime() < asignacion.entradaEl.getTime()) {
    throw new ValidationError("La novedad no puede ser antes de tu entrada.");
  }
  const nota = payload.nota?.trim() || null;
  if (payload.motivo === "OTRO" && !nota) {
    throw new ValidationError('Con "Otro", escribe qué pasó.');
  }

  const novedad = await prisma.$transaction(async (tx) => {
    const creada = await tx.visitaNovedad.create({
      data: {
        visitaId,
        personalId: asignacion.personalId,
        // El nombre de la ficha, congelado: es quien firma el reporte.
        personalNombre: nombrePersonal(asignacion.personal),
        motivo: payload.motivo,
        nota,
        fotos: payload.fotos?.length
          ? {
              create: payload.fotos.map((f) => ({
                key: f.key,
                url: publicUrlForKey(f.key),
              })),
            }
          : undefined,
        marcadaEl: instante,
        recibidaEl: new Date(),
        sinConexion: Boolean(payload.sinConexion),
        lat: payload.ubicacion?.lat ?? null,
        lng: payload.ubicacion?.lng ?? null,
        precision: payload.ubicacion?.precision ?? null,
        simulada: payload.ubicacion?.simulada ?? null,
        dispositivo: payload.dispositivo ?? null,
      },
      select: { id: true },
    });
    if (asignacion.entradaEl && !asignacion.salidaEl) {
      await tx.visitaPersonal.update({
        where: { id: asignacion.id },
        data: {
          salidaEl: instante,
          salidaRecibidaEl: new Date(),
          salidaSinConexion: Boolean(payload.sinConexion),
          ...columnasDeContexto("salida", payload),
          registradoEl: new Date(),
        },
      });
      await recalcularHorasDeVisita(tx, visitaId);
    }
    return creada;
  });

  pushNovedadDeVisita(novedad.id).catch(console.error);

  return getVisitaForViewer(visitaId, viewer);
}

/**
 * Un parte lleva al menos una tarea.
 *
 * Sin ninguna no dice nada: el informe ubica las fotos por tarea y la oficina
 * mira qué quedó cubierto, así que un parte vacío es una salida marcada y nada
 * más. Salir sin marcar era además el camino más corto de la pantalla, que es
 * el que se termina tomando.
 *
 * **Vale para quien carga lo suyo, no para la oficina.** Corregir el parte de
 * otro incluye poder dejarlo en cero —alguien que llegó y se fue— y esa es la
 * válvula de escape; es la misma oficina la que después decide si la visita
 * quedó completa.
 */
function ensureAlMenosUnaTarea(tareaIds: string[]) {
  if (tareaIds.length === 0) {
    throw new ValidationError("Marca al menos una tarea de las que hiciste.");
  }
}

/** Las que siguen existiendo, sin repetir. Una borrada no se puede cargar. */
async function tareasVivas(pedidas: string[]): Promise<string[]> {
  const tareaIds = [...new Set(pedidas)];
  if (tareaIds.length === 0) return [];
  const vivas = await prisma.tarea.count({
    where: { id: { in: tareaIds }, deletedAt: null },
  });
  if (vivas !== tareaIds.length) {
    throw new ValidationError("Alguna de las tareas ya no existe.");
  }
  return tareaIds;
}

/**
 * Registra lo que hizo una persona en una visita.
 *
 * Reemplaza sus tareas por completo en vez de sumarlas: el formulario es una
 * lista de casillas, así que lo que llega **es** el estado final. Sumar dejaría
 * sin forma de desmarcar algo cargado por error.
 *
 * La visita pasa de `PROGRAMADA` a `EN_CURSO` con el primer parte, y no se
 * cierra sola con el último: cerrarla es de oficina (ver `cerrarVisita`).
 */
export async function registrarParte(
  visitaId: string,
  viewer: Viewer,
  payload: ParteDeVisitaPayload,
) {
  const visita = await getVisitaForViewer(visitaId, viewer);
  ensureHuboOPuedeHaberTrabajo(visita.estado);

  // Un jardinero carga lo suyo; la oficina puede cargar por otro para corregir.
  let personalId: string;
  if (isAdminRole(viewer.role)) {
    if (!payload.personalId) {
      throw new ValidationError("Falta decir de quién es el parte.");
    }
    personalId = payload.personalId;
  } else if (viewer.role === "PERSONAL") {
    if (!viewer.personalId) throw new ForbiddenError();
    personalId = viewer.personalId;
  } else {
    throw new ForbiddenError();
  }

  const asignacion = visita.personal.find((p) => p.personalId === personalId);
  if (!asignacion) {
    throw new ValidationError("Esa persona no está asignada a esta visita.");
  }

  const tareaIds = [...new Set(payload.tareaIds)];
  if (tareaIds.length > 0) {
    const vivas = await prisma.tarea.count({
      where: { id: { in: tareaIds }, deletedAt: null },
    });
    if (vivas !== tareaIds.length) {
      throw new ValidationError("Alguna de las tareas ya no existe.");
    }
  }
  if (viewer.role === "PERSONAL") {
    ensureAlMenosUnaTarea(tareaIds);
    ensureSePuedeCorregir(visita.fechaProgramada, asignacion.salidaEl);
  }

  await prisma.$transaction(async (tx) => {
    await tx.visitaPersonalTarea.deleteMany({
      where: { visitaPersonalId: asignacion.id },
    });
    if (tareaIds.length > 0) {
      await tx.visitaPersonalTarea.createMany({
        data: tareaIds.map((tareaId) => ({
          visitaPersonalId: asignacion.id,
          tareaId,
        })),
      });
    }
    await tx.visitaPersonal.update({
      where: { id: asignacion.id },
      data: {
        ...(payload.entradaEl !== undefined
          ? { entradaEl: aFecha(payload.entradaEl) }
          : {}),
        ...(payload.salidaEl !== undefined
          ? { salidaEl: aFecha(payload.salidaEl) }
          : {}),
        // Se vuelve a sellar al corregir: dice "cuándo quedó registrado esto
        // que dice acá", no "cuándo lo cargó por primera vez".
        registradoEl: new Date(),
      },
    });

    if (payload.media?.length) {
      await tx.visitaMedia.createMany({
        data: payload.media.map((m) => ({
          visitaId,
          key: m.key,
          url: publicUrlForKey(m.key),
          tipo: m.tipo,
          tareaId: m.tareaId ?? null,
        })),
      });
    }

    await recalcularHorasDeVisita(tx, visitaId);

    // El primer parte la pone en curso. Si ya está cerrada, corregir un parte
    // no la reabre: la oficina decidió que estaba terminada y una corrección de
    // horas no cambia eso.
    if (visita.estado === "PROGRAMADA") {
      await tx.visita.update({
        where: { id: visitaId },
        data: { estado: "EN_CURSO" },
      });
    }
  });

  return getVisitaForViewer(visitaId, viewer);
}

/**
 * Borra el parte de alguien: vuelve a quedar como que no cargó nada.
 *
 * Es de oficina, y existe porque un parte cargado en la visita equivocada no se
 * arregla editándolo —hay que sacarlo— y porque "falta que cargue" tiene que
 * poder volver a ser verdad.
 */
export async function borrarParte(
  visitaId: string,
  viewer: Viewer,
  personalId: string,
) {
  ensureOficina(viewer);
  const visita = await getVisitaForViewer(visitaId, viewer);
  const asignacion = visita.personal.find((p) => p.personalId === personalId);
  if (!asignacion) throw new NotFoundError("Esa persona no está en la visita.");

  await prisma.$transaction(async (tx) => {
    await tx.visitaPersonalTarea.deleteMany({
      where: { visitaPersonalId: asignacion.id },
    });
    await tx.visitaPersonal.update({
      where: { id: asignacion.id },
      data: {
        entradaEl: null,
        salidaEl: null,
        entradaLat: null,
        entradaLng: null,
        entradaPrecision: null,
        entradaSimulada: null,
        entradaDispositivo: null,
        salidaLat: null,
        salidaLng: null,
        salidaPrecision: null,
        salidaSimulada: null,
        salidaDispositivo: null,
        registradoEl: null,
      },
    });
    await recalcularHorasDeVisita(tx, visitaId);
  });

  return getVisitaForViewer(visitaId, viewer);
}

// ──────────────────────────────────────────────
// Cerrar, cancelar
// ──────────────────────────────────────────────

export interface CerrarVisitaPayload {
  notas?: string | null;
  /** Solo para INCOMPLETA: por qué quedó así. */
  motivo?: string | null;
  fechaRealizada?: Date;
}

export interface CancelVisitaPayload {
  motivo?: string | null;
  fechaRealizada?: Date;
}

interface TransicionPayload {
  notas?: string | null;
  notasIncompleto?: string | null;
  fechaRealizada?: Date;
  /** Solo para NO_REALIZADA: el motivo de la lista cerrada. */
  motivoNoRealizada?: MotivoNovedad | null;
}

async function transicionar(
  visitaId: string,
  viewer: Viewer,
  estado: Extract<
    EstadoVisita,
    "COMPLETADA" | "INCOMPLETA" | "NO_REALIZADA" | "CANCELADA"
  >,
  patch: TransicionPayload = {},
) {
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: { id: true, estado: true, notas: true, fechaRealizada: true },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");

  const cambioDeEstado = visita.estado !== estado;

  const actualizada = await prisma.visita.update({
    where: { id: visitaId },
    data: {
      estado,
      // Se conserva al reeditar; solo se sella "hoy" la primera vez que sale de
      // programada sin que nadie haya dicho qué día se hizo.
      fechaRealizada:
        patch.fechaRealizada ?? visita.fechaRealizada ?? new Date(),
      notas: patch.notas ?? visita.notas,
      notasIncompleto: patch.notasIncompleto ?? null,
      // El motivo es de "no realizada" y de ningún otro estado: si la visita
      // sale de ahí, no hay motivo que conservar.
      motivoNoRealizada:
        estado === "NO_REALIZADA" ? (patch.motivoNoRealizada ?? null) : null,
      updatedById: viewer.id,
      updatedByNombre: viewer.nombre,
      // Quién la cerró se sella **en la transición**, no en cada guardado:
      // volver a abrir el formulario para corregir una fecha no convierte a
      // quien corrige en quien la cerró. Y si sale de COMPLETADA se limpia,
      // porque ya no hay nadie que la haya completado.
      ...(estado === "COMPLETADA"
        ? cambioDeEstado
          ? {
              completadaEl: new Date(),
              completadaPorId: viewer.id,
              completadaPorNombre: viewer.nombre,
            }
          : {}
        : {
            completadaEl: null,
            completadaPorId: null,
            completadaPorNombre: null,
          }),
    },
  });

  // Solo al cambiar de estado: corregir un campo no vuelve a avisarle al cliente.
  if (cambioDeEstado) {
    if (estado === "COMPLETADA") {
      enviarAlertaVisitaCompletada(visitaId).catch(console.error);
      pushAlertaCompletada(visitaId).catch(console.error);
      // Y el pedido de calificación, en el momento en que el cliente todavía
      // se acuerda de lo que vio. Un día después ya no distingue una poda de
      // la otra, y a la semana no abre el aviso.
      pushPedirCalificacion(visitaId).catch(console.error);
    } else if (estado === "INCOMPLETA") {
      enviarAlertaVisitaIncompleta(visitaId).catch(console.error);
      pushAlertaIncompleta(visitaId).catch(console.error);
    } else if (estado === "NO_REALIZADA") {
      // A la oficina, como una incompleta —la plantilla lleva el estado y el
      // motivo—, y **al cliente**: "fuimos a las 8:12 y no había nadie" es la
      // respuesta a "ustedes nunca vinieron", y conviene que le llegue el
      // mismo día.
      enviarAlertaVisitaIncompleta(visitaId).catch(console.error);
      pushAlertaIncompleta(visitaId).catch(console.error);
      pushVisitaNoRealizada(visitaId).catch(console.error);
    }
  }

  return actualizada;
}

/**
 * Da la visita por terminada. **Solo oficina.**
 *
 * El jardinero registra lo que hizo y nada más: decir que la visita está
 * terminada es mirar lo que cargaron todos —y lo que falta de las obligatorias—
 * y eso se hace desde el portal, no desde el jardín. Tampoco se cierra sola con
 * el último parte: puede quedar alguien que nunca cargue, y que eso igual esté
 * terminado es una decisión, no una cuenta.
 */
export async function completeVisita(
  visitaId: string,
  viewer: Viewer,
  payload: CerrarVisitaPayload = {},
) {
  ensureOficina(viewer);
  const visita = await getVisitaForViewer(visitaId, viewer);
  if (visita.estado === "CANCELADA") {
    throw new ConflictError("Esta visita está cancelada.");
  }
  return transicionar(visitaId, viewer, "COMPLETADA", {
    notas: payload.notas?.trim() || null,
    fechaRealizada: payload.fechaRealizada,
  });
}

/** Igual que cerrar, pero diciendo que quedó a medias y por qué. Solo oficina. */
export async function markVisitaIncomplete(
  visitaId: string,
  viewer: Viewer,
  payload: CerrarVisitaPayload & { motivo: string },
) {
  ensureOficina(viewer);
  const motivo = payload.motivo.trim();
  if (!motivo) throw new ConflictError("Debes indicar un motivo.");
  const visita = await getVisitaForViewer(visitaId, viewer);
  if (visita.estado === "CANCELADA") {
    throw new ConflictError("Esta visita está cancelada.");
  }
  return transicionar(visitaId, viewer, "INCOMPLETA", {
    notas: payload.notas?.trim() || null,
    notasIncompleto: motivo,
    fechaRealizada: payload.fechaRealizada,
  });
}

export interface NoRealizadaPayload extends CerrarVisitaPayload {
  motivo: MotivoNovedad;
  /** El texto libre: qué pasó, con las palabras de quien cierra. */
  nota?: string | null;
  /** El día de la visita nueva, si se reprograma en el mismo gesto. */
  reprogramarPara?: Date | null;
}

/**
 * Cerrarla como **no realizada**: la cuadrilla fue y no hubo trabajo. Solo
 * oficina, como las otras dos formas de cerrar.
 *
 * Es la respuesta normal a una novedad, y también vale sin ella —cuando el
 * jardinero avisó por teléfono—. Lo que la distingue de cancelar es que hubo
 * un viaje: se puede cobrar (una no realizada se ofrece al armar una orden,
 * una cancelada no), y no ocupa el día del cliente, así que se puede volver
 * esa misma tarde.
 *
 * **Reprogramar va en el mismo gesto**, porque lo primero que se decide
 * después de "nadie en casa" es cuándo se vuelve: la visita nueva se crea con
 * la misma gente, el mismo plan y las mismas obligatorias, enlazada a esta.
 * Lo que puede fallar de esa alta —el día ocupado, el cliente inactivo, el
 * plan que ya no es de esa propiedad— se comprueba **antes** de cerrar, para
 * no dejar una visita cerrada y la otra sin crear.
 */
export async function markVisitaNoRealizada(
  visitaId: string,
  viewer: Viewer,
  payload: NoRealizadaPayload,
) {
  ensureOficina(viewer);
  const visita = await getVisitaForViewer(visitaId, viewer);
  if (visita.estado === "CANCELADA") {
    throw new ConflictError("Esta visita está cancelada.");
  }
  const nota = payload.nota?.trim() || null;
  if (payload.motivo === "OTRO" && !nota) {
    throw new ValidationError('Con "Otro", escribe qué pasó.');
  }

  if (payload.reprogramarPara) {
    const cliente = await prisma.cliente.findFirst({
      where: { id: visita.clienteId, deletedAt: null },
      select: { inactivoDesde: true },
    });
    if (!cliente || cliente.inactivoDesde) {
      throw new ValidationError(
        "Este cliente está marcado como inactivo. Reactívalo desde su ficha para reprogramarle la visita.",
      );
    }
    await validarPlanDelCliente(
      visita.suscripcionId,
      visita.clienteId,
      visita.propiedadId,
    );
    const ocupado = await visitasDelDia(
      prisma,
      visita.clienteId,
      [payload.reprogramarPara],
      visita.id,
    );
    if (ocupado.length > 0) {
      throw new ConflictError(
        `Este cliente ya tiene la visita ${nombrarVisitas(ocupado)}.`,
      );
    }
  }

  await transicionar(visitaId, viewer, "NO_REALIZADA", {
    notas: payload.notas?.trim() || null,
    notasIncompleto: nota,
    motivoNoRealizada: payload.motivo,
    fechaRealizada: payload.fechaRealizada,
  });

  if (payload.reprogramarPara) {
    await createVisitasBatch(viewer, {
      clienteId: visita.clienteId,
      propiedadId: visita.propiedadId,
      fechas: [payload.reprogramarPara],
      suscripcionId: visita.suscripcionId,
      grupoId: visita.grupoId,
      tareasObligatoriasIds: visita.tareasObligatorias.map((o) => o.tarea.id),
      personalIds: visita.personal.map((p) => p.personalId),
      notas: visita.notas,
      reprogramadaDeId: visita.id,
    });
  }

  return getVisitaForViewer(visitaId, viewer);
}

/**
 * Cancelar es decir que **no se hizo**, y por eso solo vale mientras no haya
 * empezado: con alguien ya registrando su parte, lo que corresponde es cerrarla
 * como incompleta, que deja el trabajo hecho a la vista.
 */
export async function cancelVisita(
  visitaId: string,
  viewer: Viewer,
  payload: CancelVisitaPayload = {},
) {
  if (viewer.role !== "CLIENTE" && !isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
  const visita = await getVisitaForViewer(visitaId, viewer);
  if (visita.estado !== "PROGRAMADA") {
    throw new ConflictError("Esta visita ya no se puede cancelar.");
  }
  return transicionar(visitaId, viewer, "CANCELADA", {
    notasIncompleto: payload.motivo?.trim() || null,
    fechaRealizada: payload.fechaRealizada,
  });
}

// ──────────────────────────────────────────────
// Alta, edición, baja
// ──────────────────────────────────────────────

export interface CreateVisitasBatchPayload {
  clienteId: string;
  /** Dónde. Obligatorio: una visita pasa en un lugar. */
  propiedadId: string;
  fechas: Date[];
  /**
   * De qué plan es la visita, si es de alguno. `null` = trabajo aparte.
   *
   * Ya no arrastra cobertura producto por producto —no hay productos— pero
   * sigue diciendo a qué plan pertenece el trabajo, que es lo que hace falta
   * para saber qué visita cuenta contra qué contrato.
   */
  suscripcionId?: string | null;
  grupoId?: string | null;
  notas?: string | null;
  personalIds?: string[];
  /** Lo que esta visita exige que se haga. Opcional. */
  tareasObligatoriasIds?: string[];
  /** De qué visita no realizada es la repetición. Solo la pone `markVisitaNoRealizada`. */
  reprogramadaDeId?: string | null;
}

/** Las tareas exigidas tienen que existir y estar vivas. */
async function validarTareas(ids: string[]): Promise<string[]> {
  const unicas = [...new Set(ids)];
  if (unicas.length === 0) return [];
  const vivas = await prisma.tarea.count({
    where: { id: { in: unicas }, deletedAt: null },
  });
  if (vivas !== unicas.length) {
    throw new ValidationError("Alguna de las tareas no existe.");
  }
  return unicas;
}

/**
 * Que el plan sea de este cliente **y de esta propiedad**.
 *
 * Un id de otro cliente no engancha nada. Y el plan es de un jardín: una
 * visita que cuenta contra el plan de la casa pasa en la casa. Si la visita
 * es en la oficina y se cobra aparte, va sin plan; si es del plan de la
 * oficina, ese es otro plan.
 */
async function validarPlanDelCliente(
  suscripcionId: string | null | undefined,
  clienteId: string,
  propiedadId: string,
): Promise<string | null> {
  if (!suscripcionId) return null;
  const plan = await prisma.suscripcion.findFirst({
    where: { id: suscripcionId, clienteId },
    select: {
      id: true,
      numero: true,
      propiedadId: true,
      propiedad: { select: { nombre: true } },
    },
  });
  if (!plan) throw new ValidationError("Ese plan no es de este cliente.");
  if (plan.propiedadId !== propiedadId) {
    throw new ValidationError(
      `La suscripción #${plan.numero} es de ${plan.propiedad.nombre}. Elige esa propiedad, o deja la visita sin suscripción.`,
    );
  }
  return plan.id;
}

/**
 * En qué propiedad pasa la visita.
 *
 * El cliente manda el id y el servidor comprueba que sea suyo: si no, alguien
 * podría agendarle una visita en la casa de otro. Con una sola propiedad la
 * pantalla la elige sola, pero eso no la exime de venir.
 */
async function validarPropiedadDelCliente(
  propiedadId: string | null | undefined,
  clienteId: string,
): Promise<string> {
  if (!propiedadId) {
    throw new ValidationError("Elige en qué propiedad es la visita.");
  }
  const propiedad = await prisma.propiedad.findFirst({
    where: { id: propiedadId, clienteId, deletedAt: null },
    select: { id: true },
  });
  if (!propiedad) {
    throw new ValidationError("Esa propiedad no es de este cliente.");
  }
  return propiedad.id;
}

export async function createVisitasBatch(
  viewer: Viewer,
  payload: CreateVisitasBatchPayload,
) {
  // Agendar es de oficina: al irse el capataz, no quedó nadie en el campo que
  // arme la agenda de otros.
  ensureOficina(viewer);
  if (!payload.fechas.length) {
    throw new ValidationError("Selecciona al menos una fecha.");
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id: payload.clienteId, deletedAt: null },
    select: { id: true, inactivoDesde: true },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");
  // El selector ya lo muestra atenuado; esto es para que la regla no dependa
  // de la pantalla.
  if (cliente.inactivoDesde) {
    throw new ValidationError(
      "Este cliente está marcado como inactivo. Reactívalo desde su ficha para agendarle visitas."
    );
  }

  const propiedadId = await validarPropiedadDelCliente(
    payload.propiedadId,
    cliente.id,
  );

  const suscripcionId = await validarPlanDelCliente(
    payload.suscripcionId,
    cliente.id,
    propiedadId,
  );
  const tareaIds = await validarTareas(payload.tareasObligatoriasIds ?? []);
  const personalIds = [...new Set(payload.personalIds ?? [])];

  const visitas = await prisma.$transaction(async (tx) => {
    // **Una visita por cliente y por día.** Dos visitas el mismo día al mismo
    // cliente son dos viajes, dos chats y dos informes para un solo trabajo:
    // agregarle algo a un día ya agendado es editar esa visita, no abrir otra.
    // Una cancelada no ocupa el día.
    const existentes = await visitasDelDia(tx, cliente.id, payload.fechas);
    if (existentes.length > 0) {
      const detalle = nombrarVisitas(existentes);
      throw new ConflictError(
        existentes.length === 1
          ? `Este cliente ya tiene la visita ${detalle}.`
          : `Este cliente ya tiene visitas esos días: ${detalle}.`,
      );
    }

    // Tres consultas, no tres por fecha: un `create` anidado por visita son N
    // viajes de ida y vuelta dentro de la transacción, y a ~350 ms cada uno un
    // lote de 20 pasaba los 5 s de tope contra Neon.
    const creadas = await tx.visita.createManyAndReturn({
      data: payload.fechas.map((fecha) => ({
        clienteId: cliente.id,
        propiedadId,
        fechaProgramada: fecha,
        grupoId: payload.grupoId || null,
        suscripcionId,
        notas: payload.notas || null,
        reprogramadaDeId: payload.reprogramadaDeId || null,
        createdById: viewer.id,
        updatedById: viewer.id,
        updatedByNombre: viewer.nombre,
      })),
    });

    if (tareaIds.length) {
      await tx.visitaTareaObligatoria.createMany({
        data: creadas.flatMap((visita) =>
          tareaIds.map((tareaId) => ({ visitaId: visita.id, tareaId })),
        ),
      });
    }

    if (personalIds.length) {
      await tx.visitaPersonal.createMany({
        data: creadas.flatMap((visita) =>
          personalIds.map((personalId) => ({
            visitaId: visita.id,
            personalId,
            addedById: viewer.id,
          })),
        ),
      });
    }

    return creadas;
  });

  for (const visita of visitas) {
    enviarConfirmacionVisita(visita.id).catch(console.error);
    pushConfirmacionVisita(visita.id).catch(console.error);
  }

  return visitas;
}

export interface UpdateVisitaInfoPayload {
  fechaProgramada?: Date;
  fechaRealizada?: Date | null;
  /** Otra propiedad **del mismo cliente**: se agendó en la casa y era la oficina. */
  propiedadId?: string;
  grupoId?: string | null;
  suscripcionId?: string | null;
  notas?: string | null;
  /** Reemplaza el juego entero de obligatorias. */
  tareasObligatoriasIds?: string[];
}

/**
 * Editar una visita, **en cualquier estado**.
 *
 * El estado dice qué pasó con el trabajo, no si la fila está bien: arreglar una
 * fecha equivocada no debería significar borrar y rehacer, que se llevaría las
 * fotos, el chat y los partes. Cada campo se aplica solo si vino, así que un
 * PUT parcial no borra el resto.
 */
export async function updateVisitaInfo(
  visitaId: string,
  viewer: Viewer,
  payload: UpdateVisitaInfoPayload,
) {
  ensureOficina(viewer);

  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: {
      id: true,
      clienteId: true,
      estado: true,
      fechaProgramada: true,
      propiedadId: true,
      suscripcionId: true,
    },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");

  const propiedadId =
    payload.propiedadId !== undefined
      ? await validarPropiedadDelCliente(payload.propiedadId, visita.clienteId)
      : undefined;

  // El plan y la propiedad se validan como **par**, y solo si el par cambió:
  // el plan es de un jardín, así que mover la visita de casa la saca del plan
  // de la casa, y ponerle un plan exige que sea el de donde pasa. Una visita
  // vieja cuyo par ya no cumple la regla (el plan cambió de propiedad después)
  // se sigue pudiendo editar en lo demás sin tocarlo.
  const planFinal =
    payload.suscripcionId !== undefined
      ? payload.suscripcionId || null
      : visita.suscripcionId;
  const propiedadFinal = propiedadId ?? visita.propiedadId;
  const parCambio =
    planFinal !== visita.suscripcionId || propiedadFinal !== visita.propiedadId;
  const suscripcionId =
    payload.suscripcionId !== undefined || (parCambio && planFinal)
      ? parCambio
        ? await validarPlanDelCliente(planFinal, visita.clienteId, propiedadFinal)
        : planFinal
      : undefined;
  const tareaIds =
    payload.tareasObligatoriasIds !== undefined
      ? await validarTareas(payload.tareasObligatoriasIds)
      : undefined;

  // Mover la fecha también respeta la visita por día. La regla vivía solo en el
  // alta, así que se podía dejar dos el mismo día moviendo una —el camino más
  // fácil de todos, porque nadie sospecha que mover valide menos que crear—.
  if (
    payload.fechaProgramada !== undefined &&
    visita.estado !== "CANCELADA" &&
    visita.estado !== "NO_REALIZADA" &&
    payload.fechaProgramada.getTime() !== visita.fechaProgramada.getTime()
  ) {
    const ocupado = await visitasDelDia(
      prisma,
      visita.clienteId,
      [payload.fechaProgramada],
      visita.id,
    );
    if (ocupado.length > 0) {
      throw new ConflictError(
        `Este cliente ya tiene la visita ${nombrarVisitas(ocupado)}.`,
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    if (tareaIds !== undefined) {
      await tx.visitaTareaObligatoria.deleteMany({ where: { visitaId } });
      if (tareaIds.length) {
        await tx.visitaTareaObligatoria.createMany({
          data: tareaIds.map((tareaId) => ({ visitaId, tareaId })),
        });
      }
    }

    return tx.visita.update({
      where: { id: visitaId },
      data: {
        ...(payload.fechaProgramada !== undefined
          ? { fechaProgramada: payload.fechaProgramada }
          : {}),
        ...(payload.fechaRealizada !== undefined
          ? { fechaRealizada: payload.fechaRealizada }
          : {}),
        ...(propiedadId !== undefined ? { propiedadId } : {}),
        ...(payload.grupoId !== undefined ? { grupoId: payload.grupoId } : {}),
        ...(suscripcionId !== undefined ? { suscripcionId } : {}),
        ...(payload.notas !== undefined ? { notas: payload.notas } : {}),
        updatedById: viewer.id,
        updatedByNombre: viewer.nombre,
      },
    });
  });
}

/**
 * Quién va a la visita.
 *
 * Sacar a alguien **no borra su parte**: la asignación se marca con `removedAt`
 * y sus tareas se quedan colgando de ella. Todo lo que cuenta lo hecho filtra
 * `removedAt: null`, así que deja de sumar, pero si vuelve a asignarse aparece
 * otra vez tal como lo había cargado.
 */
export async function updateVisitaPersonal(
  visitaId: string,
  viewer: Viewer,
  personalIds: string[],
) {
  ensureOficina(viewer);

  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: { id: true },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");

  const deseados = [...new Set(personalIds)];
  if (deseados.length > 0) {
    const existen = await prisma.personal.count({
      where: { id: { in: deseados }, deletedAt: null },
    });
    if (existen !== deseados.length) {
      throw new ValidationError("Alguna de las personas no existe.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const actuales = await tx.visitaPersonal.findMany({
      where: { visitaId },
      select: {
        id: true,
        personalId: true,
        removedAt: true,
        entradaEl: true,
        personal: { select: { nombre: true, apellido: true } },
      },
    });
    const vigentes = new Set(
      actuales.filter((a) => !a.removedAt).map((a) => a.personalId),
    );

    const sacar = actuales.filter(
      (a) => !a.removedAt && !deseados.includes(a.personalId),
    );

    /*
     * A quien ya marcó su entrada no se lo saca.
     *
     * Marcar es un hecho: estuvo ahí a esa hora, con su ubicación y su
     * dispositivo. Sacarlo de la visita esconde esa marca de todo lo que
     * cuenta —`removedAt: null` filtra en todos lados— y de paso desaparece su
     * parte y las horas de la visita se recalculan sin él. Si de verdad no
     * tenía que estar, lo que corresponde es corregir su parte, no borrarlo
     * del registro. Quien todavía no marcó nada no dejó nada atrás y sale sin
     * problema: agendar mal a alguien pasa todos los días.
     */
    const marcado = sacar.find((a) => a.entradaEl !== null);
    if (marcado) {
      const nombre = `${marcado.personal.nombre} ${
        marcado.personal.apellido ?? ""
      }`.trim();
      throw new ConflictError(
        `${nombre} ya marcó su entrada en esta visita, así que no se lo puede quitar.`,
      );
    }

    if (sacar.length > 0) {
      await tx.visitaPersonal.updateMany({
        where: { id: { in: sacar.map((a) => a.id) } },
        data: { removedAt: new Date(), removedById: viewer.id },
      });
    }

    for (const personalId of deseados) {
      if (vigentes.has(personalId)) continue;
      // Puede existir marcada como sacada de antes: se reactiva en vez de
      // crearse, o el único `[visitaId, personalId]` lo rechaza.
      await tx.visitaPersonal.upsert({
        where: { visitaId_personalId: { visitaId, personalId } },
        create: { visitaId, personalId, addedById: viewer.id },
        update: { removedAt: null, removedById: null, addedById: viewer.id },
      });
    }

    await recalcularHorasDeVisita(tx, visitaId);
  });

  return getVisitaForViewer(visitaId, viewer);
}

/**
 * Las visitas vivas que ese cliente ya tiene en esos días.
 *
 * Compartida entre el alta y la edición: una regla que solo valida al crear es
 * una que se esquiva editando, que es el camino más fácil de los dos.
 */
async function visitasDelDia(
  tx: Pick<typeof prisma, "visita">,
  clienteId: string,
  fechas: Date[],
  excepto?: string,
) {
  return tx.visita.findMany({
    where: {
      clienteId,
      deletedAt: null,
      // Ni la cancelada ni la no realizada ocupan el día: la primera no pasó,
      // y de la segunda lo que se quiere es justamente poder volver esa tarde.
      estado: { notIn: ["CANCELADA", "NO_REALIZADA"] },
      fechaProgramada: { in: fechas },
      ...(excepto ? { id: { not: excepto } } : {}),
    },
    select: { numero: true, fechaProgramada: true },
    orderBy: { fechaProgramada: "asc" },
  });
}

function nombrarVisitas(
  visitas: { numero: number; fechaProgramada: Date }[],
): string {
  return visitas
    .map(
      (v) => `#${v.numero} (${v.fechaProgramada.toISOString().slice(0, 10)})`,
    )
    .join(", ");
}

/**
 * Elimina una visita: se marca, no se borra.
 *
 * La fila se queda —con `deletedAt` y con **quién** la eliminó— porque de ella
 * cuelgan las fotos, el chat y los partes de quienes fueron. Lo que desaparece
 * es de las listas: todas las consultas filtran `deletedAt: null`.
 *
 * **Se frena si hay una orden viva que dice ser por esta visita.** El enlace ya
 * no explica de dónde sale cada peso —eso se terminó con los productos— pero
 * una orden emitida que cita una visita que no existe es un documento que no se
 * puede explicar. En un borrador, en cambio, el enlace se suelta y listo: un
 * borrador todavía se edita.
 */
export async function softDeleteVisita(visitaId: string, viewer: Viewer) {
  ensureOficina(viewer);

  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: {
      id: true,
      estado: true,
      personal: {
        where: { removedAt: null, entradaEl: { not: null } },
        select: { id: true },
      },
      ordenes: {
        select: { orden: { select: { numero: true, estado: true } } },
      },
    },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");

  /*
   * Una visita en la que alguien trabajó no se borra.
   *
   * Borrar es para la que se agendó mal y todavía no pasó nada: el cliente
   * equivocado, el día equivocado, la que se duplicó. En cuanto alguien marcó
   * su entrada hay un hecho anotado —estuvo ahí a esa hora— y atrás vienen su
   * parte, sus fotos y el informe que las usa; sacar la visita de las listas
   * esconde todo eso sin que nadie lo decida. Lo que corresponde ahí es
   * **cancelarla**, que deja dicho que no se hizo y por qué.
   *
   * `EN_CURSO`, `COMPLETADA` e `INCOMPLETA` son exactamente "alguien trabajó",
   * y `NO_REALIZADA` es "alguien fue": el viaje y la novedad que lo cuenta son
   * un hecho igual. `CANCELADA` puede serlo también —se cancela una visita que
   * ya había empezado—, así que además se mira si hay alguna entrada marcada.
   */
  const trabajada =
    visita.estado === "EN_CURSO" ||
    visita.estado === "COMPLETADA" ||
    visita.estado === "INCOMPLETA" ||
    visita.estado === "NO_REALIZADA" ||
    visita.personal.length > 0;
  if (trabajada) {
    throw new ConflictError(
      "Esta visita ya tiene trabajo registrado, así que no se puede eliminar. Si no se hizo, cancelala.",
    );
  }

  const vivas = visita.ordenes.filter((ov) => ov.orden.estado === "CONFIRMADA");
  if (vivas.length > 0) {
    const numeros = [...new Set(vivas.map((ov) => ov.orden.numero))];
    throw new ConflictError(
      `Esta visita está en ${
        numeros.length === 1
          ? `la orden #${numeros[0]}`
          : `las órdenes ${numeros.map((n) => `#${n}`).join(", ")}`
      }. Anulá la orden primero.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Un borrador todavía se edita, así que deja de decir que es por esta
    // visita. Una anulada conserva su enlace: es su historia.
    await tx.ordenVisita.deleteMany({
      where: { visitaId, orden: { estado: "BORRADOR" } },
    });
    await tx.visita.update({
      where: { id: visitaId },
      data: {
        deletedAt: new Date(),
        deletedById: viewer.id,
        deletedByNombre: viewer.nombre,
      },
    });
  });
}

export interface ResultadoEliminarVisitas {
  eliminadas: number;
  /** Las que no se pudieron, con el motivo tal como se le muestra a la persona. */
  errores: { id: string; numero: number | null; motivo: string }[];
}

/**
 * Eliminar en lote es **una visita a la vez**: cada una tiene que mirar sus
 * propias órdenes, y una que no se puede no cancela el resto. La respuesta dice
 * cuántas fueron y nombra cada una que se quedó, con el motivo.
 */
export async function softDeleteVisitas(
  viewer: Viewer,
  ids: string[],
): Promise<ResultadoEliminarVisitas> {
  ensureOficina(viewer);
  const unicos = [...new Set(ids)];
  const numeros = new Map(
    (
      await prisma.visita.findMany({
        where: { id: { in: unicos } },
        select: { id: true, numero: true },
      })
    ).map((v) => [v.id, v.numero]),
  );

  let eliminadas = 0;
  const errores: ResultadoEliminarVisitas["errores"] = [];
  for (const id of unicos) {
    try {
      await softDeleteVisita(id, viewer);
      eliminadas++;
    } catch (error) {
      errores.push({
        id,
        numero: numeros.get(id) ?? null,
        motivo: error instanceof Error ? error.message : "No se pudo eliminar.",
      });
    }
  }
  return { eliminadas, errores };
}
