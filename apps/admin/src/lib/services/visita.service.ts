import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import type { EstadoVisita } from "@/generated/prisma/client";
import {
  enviarAlertaVisitaCompletada,
  enviarAlertaVisitaIncompleta,
  enviarConfirmacionVisita,
} from "@/lib/whatsapp/service";
import {
  pushAlertaCompletada,
  pushAlertaIncompleta,
  pushConfirmacionVisita,
} from "@/lib/push/triggers";
import { getUploadUrl, publicUrlForKey } from "@/lib/s3";
import { randomUUID } from "crypto";

export interface VisitaMediaInput {
  key: string;
  tipo: "imagen" | "video";
  /// Producto de la visita al que corresponde la foto. Opcional.
  productoId?: string | null;
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

export async function removeVisitaMedia(
  visitaId: string,
  mediaId: string,
  viewer: Viewer
) {
  if (viewer.role !== "PERSONAL_ADMIN" && !isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
  // Authorization: the viewer must be allowed to see this visita.
  await getVisitaForViewer(visitaId, viewer);

  const media = await prisma.visitaMedia.findFirst({
    where: { id: mediaId, visitaId },
    select: { id: true },
  });
  if (!media) throw new NotFoundError("Archivo no encontrado");

  await prisma.visitaMedia.delete({ where: { id: mediaId } });
}

/**
 * Cambiar a qué producto corresponde un archivo.
 *
 * No tiene que ser de la visita. En el campo se fotografía lo que aparece —un
 * problema de riego durante una poda, material que se dejó— y obligar a que la
 * etiqueta saliera de los productos agendados dejaba esas fotos sin clasificar.
 * El informe ya arma secciones con cualquier producto del catálogo.
 *
 * Sí tiene que existir y estar activo: una etiqueta a un producto borrado no
 * agrupa nada y no se puede volver a elegir.
 */
export async function etiquetarVisitaMedia(
  visitaId: string,
  mediaId: string,
  productoId: string | null,
  viewer: Viewer
) {
  if (viewer.role !== "PERSONAL_ADMIN" && !isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
  await getVisitaForViewer(visitaId, viewer);

  const media = await prisma.visitaMedia.findFirst({
    where: { id: mediaId, visitaId },
    select: { id: true },
  });
  if (!media) throw new NotFoundError("Archivo no encontrado");

  if (productoId) {
    const producto = await prisma.producto.findFirst({
      where: { id: productoId, deletedAt: null },
      select: { id: true },
    });
    if (!producto) throw new ValidationError("Ese producto no existe");
  }

  return prisma.visitaMedia.update({
    where: { id: mediaId },
    data: { productoId },
    select: { id: true, productoId: true },
  });
}

export async function requestVisitaMediaUploads(
  visitaId: string,
  viewer: Viewer,
  files: RequestUploadFile[]
): Promise<UploadDescriptor[]> {
  if (viewer.role !== "PERSONAL_ADMIN" && !isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
  // Authorization: the viewer must be allowed to see this visita.
  await getVisitaForViewer(visitaId, viewer);

  return Promise.all(
    files.map(async (f) => {
      const ext = f.fileName.includes(".")
        ? f.fileName.split(".").pop()
        : "";
      const key = `visitas/${visitaId}/${randomUUID()}${ext ? `.${ext}` : ""}`;
      const uploadUrl = await getUploadUrl(key, f.contentType);
      const tipo: "imagen" | "video" = f.contentType.startsWith("video/")
        ? "video"
        : "imagen";
      return { key, uploadUrl, tipo, contentType: f.contentType };
    })
  );
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
      direccion: true,
      ciudad: true,
      sector: { select: { id: true, nombre: true } },
    },
  },
  // `select`, no `include`: esta forma la leen también CLIENTE y PERSONAL, y
  // `precio`/`ivaTasa` de VisitaProducto no tienen por qué viajar en el JSON.
  // Lo que factura lee los montos por su cuenta (ver orden.service.ts).
  productos: {
    orderBy: { posicion: "asc" },
    select: {
      productoId: true,
      suscripcionItemId: true,
      posicion: true,
      // Misma forma que `PRODUCTOS_DE_VISITA_SELECT`: la lista del portal se
      // recarga por esta API al filtrar, y si las dos formas no coinciden el
      // filtro de "sin orden" funciona al cargar y deja de funcionar después.
      ordenLinea: {
        select: {
          ordenId: true,
          orden: { select: { numero: true, estado: true } },
        },
      },
      producto: {
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          tipo: true,
        },
      },
    },
  },
  personal: {
    where: { removedAt: null },
    include: {
      personal: {
        select: { id: true, nombre: true, apellido: true, tipo: true },
      },
    },
  },
  grupo: { select: { id: true, nombre: true } },
  media: { orderBy: { createdAt: "asc" } },
} as const;

async function ensureViewerCanSeeVisita(
  viewer: Viewer,
  visita: {
    cliente: {
      userId: string | null;
      sector: { id: string; nombre: string } | null;
    };
  }
): Promise<void> {
  if (isAdminRole(viewer.role)) return;
  if (viewer.role === "CLIENTE") {
    if (visita.cliente.userId === viewer.id) return;
    throw new ForbiddenError();
  }
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorId = visita.cliente.sector?.id ?? null;
    if (!sectorId) throw new ForbiddenError();
    const sectorIds = await getSectorIdsForUser(viewer.id);
    if (sectorIds.includes(sectorId)) return;
    throw new ForbiddenError();
  }
  throw new ForbiddenError();
}

export async function getVisitaForViewer(visitaId: string, viewer: Viewer) {
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    include: VISITA_DETAIL_INCLUDE,
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");
  await ensureViewerCanSeeVisita(viewer, visita);
  return visita;
}

export interface ListVisitasFilters {
  from?: Date;
  to?: Date;
  estado?: EstadoVisita;
  clienteId?: string;
  productoId?: string;
  cursor?: string;
  limit?: number;
  defaultFromToday?: boolean;
}

async function buildVisitaWhereForViewer(
  viewer: Viewer
): Promise<Record<string, unknown>> {
  if (isAdminRole(viewer.role)) {
    return { deletedAt: null };
  }
  if (viewer.role === "PERSONAL_ADMIN") {
    if (!viewer.personalId && !viewer.id) throw new ForbiddenError();
    const sectorIds = await getSectorIdsForUser(viewer.id);
    return {
      deletedAt: null,
      cliente: { sectorId: { in: sectorIds } },
    };
  }
  if (viewer.role === "CLIENTE") {
    if (!viewer.clienteId) throw new ForbiddenError();
    return {
      deletedAt: null,
      clienteId: viewer.clienteId,
    };
  }
  throw new ForbiddenError();
}

async function getSectorIdsForUser(userId: string): Promise<string[]> {
  const assignments = await prisma.sectorAdmin.findMany({
    where: { userId },
    select: { sectorId: true },
  });
  return assignments.map((a) => a.sectorId);
}

export async function listVisitas(
  viewer: Viewer,
  filters: ListVisitasFilters = {}
) {
  const where = await buildVisitaWhereForViewer(viewer);
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
  // Una visita matchea el filtro de servicio si CUALQUIERA de sus servicios lo es.
  if (filters.productoId) {
    where.productos = {
      some: { productoId: filters.productoId },
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
  const items = hasMore ? visitas.slice(0, limit) : visitas;
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

export interface CancelVisitaPayload {
  motivo?: string | null;
  fechaRealizada?: Date;
}

export interface CompleteVisitaPayload {
  notes?: string | null;
  fechaRealizada?: Date;
  horaEntrada?: string | null;
  horaSalida?: string | null;
  media?: VisitaMediaInput[];
}

export interface IncompleteVisitaPayload {
  reason: string;
  fechaRealizada?: Date;
  horaEntrada?: string | null;
  horaSalida?: string | null;
  media?: VisitaMediaInput[];
}

interface TransitionPayload {
  notas?: string | null;
  notasIncompleto?: string | null;
  fechaRealizada?: Date;
  horaEntrada?: string | null;
  horaSalida?: string | null;
}

async function transitionToTerminal(
  visitaId: string,
  viewer: Viewer,
  estado: Extract<EstadoVisita, "COMPLETADA" | "INCOMPLETA" | "CANCELADA">,
  patch: TransitionPayload = {},
  media?: VisitaMediaInput[]
) {
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: {
      id: true,
      estado: true,
      notas: true,
      fechaRealizada: true,
    },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");

  const stateChanged = visita.estado !== estado;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.visita.update({
      where: { id: visitaId },
      data: {
        estado,
        // Preserve existing fechaRealizada on edit; only stamp "now" when
        // first transitioning out of PROGRAMADA.
        fechaRealizada:
          patch.fechaRealizada ?? visita.fechaRealizada ?? new Date(),
        ...(patch.horaEntrada !== undefined ? { horaEntrada: patch.horaEntrada } : {}),
        ...(patch.horaSalida !== undefined ? { horaSalida: patch.horaSalida } : {}),
        notas: patch.notas ?? visita.notas,
        notasIncompleto: patch.notasIncompleto ?? null,
        updatedById: viewer.id,
      },
    });

    if (media && media.length > 0) {
      // Solo aceptamos etiquetas de productos que realmente cubre esta visita.
      const serviciosDeVisita = await tx.visitaProducto.findMany({
        where: { visitaId },
        select: { productoId: true },
      });
      const permitidos = new Set(serviciosDeVisita.map((vs) => vs.productoId));
      await tx.visitaMedia.createMany({
        data: media.map((m) => ({
          visitaId,
          key: m.key,
          url: publicUrlForKey(m.key),
          tipo: m.tipo,
          productoId:
            m.productoId && permitidos.has(m.productoId) ? m.productoId : null,
        })),
      });
    }

    return result;
  });

  // Only fire side-effects on an actual state change; field-only edits
  // shouldn't re-notify the cliente.
  if (stateChanged) {
    if (estado === "COMPLETADA") {
      enviarAlertaVisitaCompletada(visitaId).catch(console.error);
      pushAlertaCompletada(visitaId).catch(console.error);
    } else if (estado === "INCOMPLETA") {
      enviarAlertaVisitaIncompleta(visitaId).catch(console.error);
      pushAlertaIncompleta(visitaId).catch(console.error);
    }
  }

  return updated;
}

export async function cancelVisita(
  visitaId: string,
  viewer: Viewer,
  payload: CancelVisitaPayload = {}
) {
  // CLIENTEs cancel their own visit; ADMIN/STAFF can also cancel from the web.
  if (
    viewer.role !== "CLIENTE" &&
    !isAdminRole(viewer.role)
  ) {
    throw new ForbiddenError();
  }
  const visita = await getVisitaForViewer(visitaId, viewer);
  if (visita.estado !== "PROGRAMADA") {
    throw new ConflictError("Esta visita ya no se puede cancelar.");
  }
  return transitionToTerminal(visitaId, viewer, "CANCELADA", {
    notasIncompleto: payload.motivo?.trim() || null,
    fechaRealizada: payload.fechaRealizada,
  });
}

/**
 * Deja armado el borrador de orden con lo que la visita dejó por cobrar.
 *
 * Corre al **completar**, no al agendar: recién ahí el trabajo ocurrió, los
 * productos dejaron de moverse y tiene sentido ponerle precio. Una visita
 * agendada todavía se corre, se edita o se cancela.
 *
 * Nace en **BORRADOR y en $0**: la visita no lleva plata —se cotiza al
 * facturar— así que el borrador existe para que alguien le ponga el número, no
 * para cobrarse solo. Es lo mismo que hace el cron con las suscripciones, salvo
 * que ahí el precio ya se conoce.
 *
 * **No puede hacer fallar el completar.** Si el producto no está vinculado con
 * Contífico, `crearOrden` lo rechaza; la visita se completa igual y el trabajo
 * queda en pendientes, como antes. Terminar una visita en el campo no puede
 * depender de cómo esté el catálogo.
 */
async function borradorDeVisita(visitaId: string, viewer: Viewer) {
  const sueltos = await prisma.visitaProducto.findMany({
    where: { visitaId, suscripcionItemId: null, ordenLinea: null },
    orderBy: { posicion: "asc" },
    select: {
      id: true,
      productoId: true,
      producto: { select: { nombre: true, ivaTasa: true } },
      visita: { select: { clienteId: true } },
    },
  });
  // Todo cubierto por el plan, o ya facturado: no hay orden que crear.
  if (sueltos.length === 0) return null;

  const { crearOrden } = await import("./orden.service");
  return crearOrden(viewer, {
    clienteId: sueltos[0].visita.clienteId,
    lineas: sueltos.map((vp) => ({
      descripcion: vp.producto.nombre,
      cantidad: 1,
      // Sin precio: es justamente lo que hay que decidir sobre el borrador.
      precioUnitario: 0,
      ivaTasa: Number(vp.producto.ivaTasa ?? 0),
      productoId: vp.productoId,
      visitaProductoId: vp.id,
    })),
  });
}

/**
 * Pone al día un borrador al que se le sacó una línea.
 *
 * Los totales están guardados en la orden, así que borrar una línea sola los
 * deja mintiendo. Si no quedó ninguna línea, la orden se borra: una orden vacía
 * no representa nada y encima no se puede guardar.
 */
async function recalcularBorrador(ordenId: string, viewer: Viewer) {
  const orden = await prisma.orden.findUnique({
    where: { id: ordenId },
    select: {
      estado: true,
      lineas: {
        orderBy: { posicion: "asc" },
        select: {
          descripcion: true,
          cantidad: true,
          precioUnitario: true,
          ivaTasa: true,
          productoId: true,
          visitaProductoId: true,
          suscripcionItemId: true,
          periodoInicio: true,
          periodoFin: true,
        },
      },
    },
  });
  if (!orden || orden.estado !== "BORRADOR") return;

  if (orden.lineas.length === 0) {
    await prisma.orden.delete({ where: { id: ordenId } });
    return;
  }

  const { actualizarOrden } = await import("./orden.service");
  await actualizarOrden(viewer, ordenId, {
    lineas: orden.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      ivaTasa: Number(l.ivaTasa),
      productoId: l.productoId,
      visitaProductoId: l.visitaProductoId,
      suscripcionItemId: l.suscripcionItemId,
      periodoInicio: l.periodoInicio,
      periodoFin: l.periodoFin,
    })),
  });
}

/**
 * Suma a la orden en borrador de la visita lo que se le acabe de agregar.
 *
 * Una visita se factura completa, así que si ya tiene su orden armada y alguien
 * le agrega un producto, ese producto tiene que entrar ahí. Sin esto quedaba
 * fuera y terminaba en una segunda orden por la misma visita, que es justo lo
 * que la regla quiere evitar.
 *
 * **Solo sobre un borrador.** Facturada la orden, el documento ya salió y no se
 * toca: el producto nuevo queda pendiente y se cobra aparte, que es lo honesto.
 * Entra en $0, como todo lo que sale de una visita.
 */
async function sumarAlBorrador(visitaId: string, viewer: Viewer) {
  const nuevos = await prisma.visitaProducto.findMany({
    where: { visitaId, suscripcionItemId: null, ordenLinea: null, liberadoAt: null },
    orderBy: { posicion: "asc" },
    select: {
      id: true,
      productoId: true,
      producto: { select: { nombre: true, ivaTasa: true } },
    },
  });
  if (nuevos.length === 0) return;

  // La orden de esta visita, si está en borrador. Se llega por sus líneas.
  const orden = await prisma.orden.findFirst({
    where: {
      estado: "BORRADOR",
      lineas: { some: { visitaProducto: { visitaId } } },
    },
    select: {
      id: true,
      lineas: {
        orderBy: { posicion: "asc" },
        select: {
          descripcion: true,
          cantidad: true,
          precioUnitario: true,
          ivaTasa: true,
          productoId: true,
          visitaProductoId: true,
          suscripcionItemId: true,
          periodoInicio: true,
          periodoFin: true,
        },
      },
    },
  });
  if (!orden) return;

  const { actualizarOrden } = await import("./orden.service");
  await actualizarOrden(viewer, orden.id, {
    lineas: [
      ...orden.lineas.map((l) => ({
        descripcion: l.descripcion,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        ivaTasa: Number(l.ivaTasa),
        productoId: l.productoId,
        visitaProductoId: l.visitaProductoId,
        suscripcionItemId: l.suscripcionItemId,
        periodoInicio: l.periodoInicio,
        periodoFin: l.periodoFin,
      })),
      ...nuevos.map((vp) => ({
        descripcion: vp.producto.nombre,
        cantidad: 1,
        precioUnitario: 0,
        ivaTasa: Number(vp.producto.ivaTasa ?? 0),
        productoId: vp.productoId,
        visitaProductoId: vp.id,
      })),
    ],
  });
}

export async function completeVisita(
  visitaId: string,
  viewer: Viewer,
  payload: CompleteVisitaPayload = {}
) {
  if (viewer.role !== "PERSONAL_ADMIN" && !isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
  const visita = await getVisitaForViewer(visitaId, viewer);
  // Allow re-edit from PROGRAMADA, COMPLETADA, or INCOMPLETA. Cancelled
  // visitas can only be reopened explicitly, not via complete/incomplete.
  if (visita.estado === "CANCELADA") {
    throw new ConflictError("Esta visita está cancelada.");
  }
  const yaEstabaCompletada = visita.estado === "COMPLETADA";
  const actualizada = await transitionToTerminal(
    visitaId,
    viewer,
    "COMPLETADA",
    {
      notas: payload.notes?.trim() || null,
      fechaRealizada: payload.fechaRealizada,
      horaEntrada: payload.horaEntrada,
      horaSalida: payload.horaSalida,
    },
    payload.media
  );

  // Solo al completarla de verdad: reeditar una visita ya completada no tiene
  // por qué generar otra orden.
  if (!yaEstabaCompletada) {
    try {
      await borradorDeVisita(visitaId, viewer);
    } catch (error) {
      console.error(`No se pudo crear el borrador de la visita ${visitaId}:`, error);
    }
  }

  return actualizada;
}

export async function markVisitaIncomplete(
  visitaId: string,
  viewer: Viewer,
  payload: IncompleteVisitaPayload
) {
  if (viewer.role !== "PERSONAL_ADMIN" && !isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
  const trimmed = payload.reason.trim();
  if (!trimmed) {
    throw new ConflictError("Debes indicar un motivo.");
  }
  const visita = await getVisitaForViewer(visitaId, viewer);
  if (visita.estado === "CANCELADA") {
    throw new ConflictError("Esta visita está cancelada.");
  }
  return transitionToTerminal(
    visitaId,
    viewer,
    "INCOMPLETA",
    {
      notasIncompleto: trimmed,
      fechaRealizada: payload.fechaRealizada,
      horaEntrada: payload.horaEntrada,
      horaSalida: payload.horaSalida,
    },
    payload.media
  );
}

// ──────────────────────────────────────────────
// Creation, edit, soft-delete
// ──────────────────────────────────────────────

/**
 * Un producto sin vincular con Contífico no entra a ningún lado.
 *
 * Se validaba recién al crear la orden, y para entonces el trabajo ya se había
 * hecho: descubrir ahí que no se puede facturar no le sirve a nadie. Vincular
 * es manual y a propósito —Contífico no tiene DELETE y un producto creado por
 * error queda para siempre—, así que lo que se corta es usarlo, no crearlo.
 */
async function ensureVinculados(productoIds: string[]): Promise<void> {
  const sinVincular = await prisma.producto.findMany({
    where: { id: { in: productoIds }, contificoProductoId: null },
    select: { nombre: true },
  });
  if (sinVincular.length > 0) {
    const nombres = sinVincular.map((p) => `"${p.nombre}"`).join(", ");
    throw new ValidationError(
      `${nombres} ${sinVincular.length === 1 ? "no está vinculado" : "no están vinculados"} con Contífico, así que no se ${sinVincular.length === 1 ? "podría" : "podrían"} facturar. Vinculalo desde su ficha antes de usarlo.`
    );
  }
}

/**
 * Qué productos de esta selección cubre el plan de la visita.
 *
 * **No es una decisión, es una consulta.** Con la visita ligada a un plan, lo
 * que ese plan cubre es lo que el plan contiene; sin plan, no cubre nada y todo
 * se cobra aparte. Antes esto se elegía producto por producto y era la misma
 * pregunta hecha N veces.
 *
 * Se valida que el plan sea de este cliente: un id de otro no engancha nada.
 */
async function coberturaDelPlan(
  suscripcionId: string | null,
  clienteId: string,
  productoIds: string[],
  tx: { suscripcionItem: { findMany: typeof prisma.suscripcionItem.findMany } } = prisma
): Promise<Map<string, string>> {
  if (!suscripcionId) return new Map();
  const items = await tx.suscripcionItem.findMany({
    where: {
      productoId: { in: productoIds },
      suscripcionId,
      suscripcion: { clienteId },
    },
    select: { id: true, productoId: true },
  });
  return new Map(items.map((i) => [i.productoId, i.id]));
}

/**
 * Un producto que cubre la visita. Sin plata: eso se decide al facturar, y sin
 * cobertura: eso sale del plan de la visita (`suscripcionId`), no del producto.
 */
export interface ProductoDeVisitaInput {
  productoId: string;
}

export interface CreateVisitasBatchPayload {
  /**
   * De qué plan es la visita. `null` o ausente = trabajo aparte.
   *
   * Lo que ese plan cubra de los productos elegidos se deduce del plan; el
   * resto queda como trabajo suelto, listo para facturarse.
   */
  suscripcionId?: string | null;
  clienteId: string;
  productos: ProductoDeVisitaInput[];
  fechas: Date[];
  grupoId?: string | null;
  notas?: string | null;
  personalIds?: string[];
}

export async function createVisitasBatch(
  viewer: Viewer,
  payload: CreateVisitasBatchPayload
) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
  if (!payload.fechas.length) {
    throw new ValidationError("Selecciona al menos una fecha.");
  }

  // Un mismo producto elegido dos veces colapsa en uno.
  const porProducto = new Map<string, ProductoDeVisitaInput>();
  for (const p of payload.productos ?? []) {
    if (!porProducto.has(p.productoId)) porProducto.set(p.productoId, p);
  }
  const seleccion = [...porProducto.values()];
  if (seleccion.length === 0) {
    throw new ValidationError("Selecciona al menos un producto.");
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id: payload.clienteId, deletedAt: null },
    select: { id: true, sectorId: true },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");

  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorIds = await getSectorIdsForUser(viewer.id);
    if (!cliente.sectorId || !sectorIds.includes(cliente.sectorId)) {
      throw new ForbiddenError("No tienes acceso a este cliente.");
    }
  }

  const productos = await prisma.producto.findMany({
    where: { id: { in: seleccion.map((p) => p.productoId) }, deletedAt: null },
    select: { id: true, nombre: true },
  });
  if (productos.length !== seleccion.length) {
    throw new ValidationError("Alguno de los productos no existe.");
  }
  await ensureVinculados(seleccion.map((p) => p.productoId));

  // Qué planes activos del cliente podrían cubrir estos productos. Enlazarlos o
  // no lo decide el payload: puede haber plan y aun así querer cobrar aparte un
  // trabajo que se acordó por fuera.
  //
  // Lo que no se acepta es un id de suscripción venido del cliente HTTP: se
  // manda un booleano y el servidor busca el ítem, para que nadie enganche una
  // visita al plan de otro.
  //
  // `visitasPorPeriodo` no es un tope: se puede agendar de más. Quién decide si
  // una visita extra se cobra es quien arma la orden, no el que agenda.
  const itemPorProducto = await coberturaDelPlan(
    payload.suscripcionId ?? null,
    cliente.id,
    seleccion.map((p) => p.productoId)
  );
  const itemElegido = (p: ProductoDeVisitaInput): string | null =>
    itemPorProducto.get(p.productoId) ?? null;

  const personalIds = payload.personalIds ?? [];

  const visitas = await prisma.$transaction(async (tx) => {
    // Choque de fechas: ya hay visita ese día que cubre alguno de los productos.
    const existing = await tx.visita.findMany({
      where: {
        clienteId: cliente.id,
        fechaProgramada: { in: payload.fechas },
        estado: { not: "CANCELADA" },
        deletedAt: null,
        productos: {
          some: { productoId: { in: seleccion.map((p) => p.productoId) } },
        },
      },
      select: { fechaProgramada: true },
    });
    if (existing.length > 0) {
      const dupes = [
        ...new Set(
          existing.map((e) => e.fechaProgramada.toISOString().split("T")[0])
        ),
      ].join(", ");
      throw new ConflictError(`Ya existen visitas para estas fechas: ${dupes}`);
    }

    // Tres consultas, no tres por fecha.
    //
    // Un `create` anidado por visita son N viajes de ida y vuelta dentro de la
    // transacción, y a ~350 ms cada uno contra Neon un lote de 20 pasaba los 5 s
    // de timeout: la transacción se caía sola y Prisma lo reportaba como una
    // violación de foreign key, que no dice nada de lo que pasó.
    const creadas = await tx.visita.createManyAndReturn({
      data: payload.fechas.map((fecha) => ({
        clienteId: cliente.id,
        fechaProgramada: fecha,
        grupoId: payload.grupoId || null,
        // Solo si el plan es de este cliente: `coberturaDelPlan` ya lo validó,
        // y sin ítems cubiertos guardar el id sería una relación vacía.
        suscripcionId: itemPorProducto.size > 0 ? payload.suscripcionId : null,
        notas: payload.notas || null,
        createdById: viewer.id,
        updatedById: viewer.id,
      })),
    });

    await tx.visitaProducto.createMany({
      data: creadas.flatMap((visita) =>
        seleccion.map((p, idx) => ({
          visitaId: visita.id,
          productoId: p.productoId,
          suscripcionItemId: itemElegido(p),
          posicion: idx,
        }))
      ),
    });

    if (personalIds.length) {
      await tx.visitaPersonal.createMany({
        data: creadas.flatMap((visita) =>
          personalIds.map((pid) => ({
            visitaId: visita.id,
            personalId: pid,
            addedById: viewer.id,
          }))
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

export async function updateVisitaPersonal(
  visitaId: string,
  viewer: Viewer,
  personalIds: string[]
) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }

  // Sin candado de estado, igual que `updateVisitaInfo`: quién fue a una visita
  // ya hecha se corrige. Anotar mal la cuadrilla es un error de carga, no un
  // motivo para dejar el dato equivocado para siempre.
  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: { id: true },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");

  const newIds = new Set(personalIds);
  const currentPersonal = await prisma.visitaPersonal.findMany({
    where: { visitaId, removedAt: null },
  });
  const currentIds = new Set(currentPersonal.map((p) => p.personalId));

  const toRemove = currentPersonal.filter((p) => !newIds.has(p.personalId));
  const toAdd = [...newIds].filter((pid) => !currentIds.has(pid));

  await prisma.$transaction([
    ...toRemove.map((p) =>
      prisma.visitaPersonal.update({
        where: { id: p.id },
        data: { removedAt: new Date(), removedById: viewer.id },
      })
    ),
    ...toAdd.map((pid) =>
      prisma.visitaPersonal.create({
        data: { visitaId, personalId: pid, addedById: viewer.id },
      })
    ),
    prisma.visita.update({
      where: { id: visitaId },
      data: { updatedById: viewer.id },
    }),
  ]);
}

/**
 * Edición de una visita ya creada. Solo se toca lo que viene: un PUT parcial no
 * puede borrar el grupo ni las notas por omisión.
 *
 * No mira el estado a propósito. Una visita completada con la fecha o el
 * producto equivocado se corrige; obligar a borrarla y rehacerla perdería sus
 * fotos y su chat.
 */
export interface UpdateVisitaInfoPayload {
  /** `null` la desvincula del plan y todo su trabajo pasa a cobrarse aparte. */
  suscripcionId?: string | null;
  fechaProgramada?: Date;
  /// `null` la borra. La completa el formulario de cierre, pero se corrige acá.
  fechaRealizada?: Date | null;
  horaEntrada?: string | null;
  horaSalida?: string | null;
  grupoId?: string | null;
  notas?: string | null;
  /// Si viene, reemplaza el conjunto de productos de la visita.
  productoIds?: string[];
  /// Igual que `productoIds`, pero pudiendo decir qué se descuenta del plan.
  productos?: ProductoDeVisitaInput[];
}

export async function updateVisitaInfo(
  visitaId: string,
  viewer: Viewer,
  payload: UpdateVisitaInfoPayload
) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }

  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: { id: true, clienteId: true, suscripcionId: true },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");

  // `productoIds` sigue valiendo (lo usan la app móvil y llamadas viejas);
  // `productos` es la forma que además dice qué se descuenta del plan.
  const pedidos: ProductoDeVisitaInput[] | null =
    payload.productos ??
    (payload.productoIds?.map((productoId) => ({ productoId })) ?? null);

  let seleccion: ProductoDeVisitaInput[] | null = null;
  if (pedidos) {
    const porProducto = new Map<string, ProductoDeVisitaInput>();
    for (const p of pedidos) {
      if (!porProducto.has(p.productoId)) porProducto.set(p.productoId, p);
    }
    seleccion = [...porProducto.values()];
    if (seleccion.length === 0) {
      throw new ValidationError("La visita debe tener al menos un producto.");
    }
    const existen = await prisma.producto.count({
      where: { id: { in: seleccion.map((p) => p.productoId) }, deletedAt: null },
    });
    if (existen !== seleccion.length) {
      throw new ValidationError("Alguno de los productos no existe.");
    }
    await ensureVinculados(seleccion.map((p) => p.productoId));
  }

  const productos = seleccion;
  /** Borradores a los que se les sacó una línea: hay que recalcularlos. */
  let ordenesTocadas: string[] = [];
  const actualizada = await prisma.$transaction(async (tx) => {
    if (productos) {
      const ids = productos.map((p) => p.productoId);

      // No se saca de la visita algo que ya se cobró.
      //
      // `OrdenLinea.visitaProductoId` es `onDelete: SetNull`, así que borrarlo
      // no rompía nada a la vista: la línea seguía cobrando y perdía en silencio
      // de dónde venía. El cliente pagaba por un trabajo que la visita ya no
      // dice que se hizo, y nada quedaba registrado. Para deshacerlo hay que
      // anular la orden, que es lo que libera la procedencia.
      const yaCobrados = await tx.visitaProducto.findMany({
        where: {
          visitaId,
          productoId: { notIn: ids },
          ordenLinea: { isNot: null },
        },
        select: {
          id: true,
          producto: { select: { nombre: true } },
          ordenLinea: {
            select: {
              id: true,
              ordenId: true,
              orden: { select: { numero: true, estado: true } },
            },
          },
        },
      });
      // Un borrador todavía se edita: sacar el producto de la visita también lo
      // saca de la orden. Confirmada ya salió el documento y no se toca.
      const enFirme = yaCobrados.filter(
        (vp) => vp.ordenLinea!.orden.estado !== "BORRADOR"
      );
      if (enFirme.length > 0) {
        const detalle = enFirme
          .map(
            (vp) =>
              `"${vp.producto.nombre}" (orden #${vp.ordenLinea!.orden.numero})`
          )
          .join(", ");
        throw new ConflictError(
          `No se puede quitar de la visita algo que ya está facturado: ${detalle}. Anulá la orden primero.`
        );
      }
      // Las líneas del borrador se borran **antes** que el VisitaProducto: si
      // no, `onDelete: SetNull` las deja huérfanas cobrando sin procedencia.
      const enBorrador = yaCobrados.filter(
        (vp) => vp.ordenLinea!.orden.estado === "BORRADOR"
      );
      if (enBorrador.length > 0) {
        await tx.ordenLinea.deleteMany({
          where: { id: { in: enBorrador.map((vp) => vp.ordenLinea!.id) } },
        });
        ordenesTocadas = [
          ...new Set(enBorrador.map((vp) => vp.ordenLinea!.ordenId)),
        ];
      }

      // Las fotos etiquetadas con un producto que se quita quedan sin etiqueta.
      await tx.visitaMedia.updateMany({
        where: { visitaId, productoId: { notIn: ids } },
        data: { productoId: null },
      });
      await tx.visitaProducto.deleteMany({
        where: { visitaId, productoId: { notIn: ids } },
      });

      // El plan que queda después de esta edición: el que venga en el payload
      // si vino, y si no el que ya tenía. `null` explícito la desvincula.
      const planFinal =
        payload.suscripcionId !== undefined
          ? payload.suscripcionId
          : visita.suscripcionId;
      const itemPorProducto = await coberturaDelPlan(
        planFinal,
        visita.clienteId,
        ids,
        tx
      );

      for (const [idx, p] of productos.entries()) {
        const item = itemPorProducto.get(p.productoId) ?? null;
        await tx.visitaProducto.upsert({
          where: { visitaId_productoId: { visitaId, productoId: p.productoId } },
          create: {
            visitaId,
            productoId: p.productoId,
            suscripcionItemId: item,
            posicion: idx,
          },
          // El enlace también se actualiza: si no, desmarcar "cubierto" en un
          // producto que ya estaba en la visita no haría nada.
          update: { posicion: idx, suscripcionItemId: item },
        });
      }
    }
    // Cambiar de plan sin tocar los productos igual mueve la cobertura: es
    // justamente lo que hace "desvincular". Sin esto, `suscripcionId` quedaba
    // en null y los productos seguían marcados como cubiertos.
    if (payload.suscripcionId !== undefined && !productos) {
      const actuales = await tx.visitaProducto.findMany({
        where: { visitaId },
        select: {
          id: true,
          productoId: true,
          ordenLinea: { select: { id: true } },
        },
      });
      const cobertura = await coberturaDelPlan(
        payload.suscripcionId,
        visita.clienteId,
        actuales.map((vp) => vp.productoId),
        tx
      );
      for (const vp of actuales) {
        // Lo ya facturado no se toca: marcarlo como cubierto lo dejaría
        // cobrado y cubierto a la vez.
        if (vp.ordenLinea) continue;
        await tx.visitaProducto.update({
          where: { id: vp.id },
          data: { suscripcionItemId: cobertura.get(vp.productoId) ?? null },
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
        ...(payload.horaEntrada !== undefined
          ? { horaEntrada: payload.horaEntrada }
          : {}),
        ...(payload.horaSalida !== undefined
          ? { horaSalida: payload.horaSalida }
          : {}),
        ...(payload.grupoId !== undefined ? { grupoId: payload.grupoId } : {}),
        ...(payload.suscripcionId !== undefined
          ? { suscripcionId: payload.suscripcionId }
          : {}),
        ...(payload.notas !== undefined ? { notas: payload.notas } : {}),
        updatedById: viewer.id,
      },
    });
  });

  // Fuera de la transacción: es otra agregación y no debe poder tumbar la
  // edición de la visita, que es lo que la persona pidió.
  if (productos) {
    try {
      for (const ordenId of ordenesTocadas) {
        await recalcularBorrador(ordenId, viewer);
      }
      await sumarAlBorrador(visitaId, viewer);
    } catch (error) {
      console.error(
        `No se pudo sincronizar el borrador de la visita ${visitaId}:`,
        error
      );
    }
  }

  return actualizada;
}

export async function softDeleteVisita(visitaId: string, viewer: Viewer) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }

  try {
    await prisma.visita.update({
      where: { id: visitaId },
      data: { deletedAt: new Date(), updatedById: viewer.id },
    });
  } catch {
    throw new NotFoundError("Visita no encontrada");
  }
}
