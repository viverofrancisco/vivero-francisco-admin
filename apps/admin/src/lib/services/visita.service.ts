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
    orderBy: { orden: "asc" },
    select: {
      productoId: true,
      suscripcionItemId: true,
      orden: true,
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
  return transitionToTerminal(
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

/** Un producto que cubre la visita. Sin plata: eso se decide al facturar. */
export interface ProductoDeVisitaInput {
  productoId: string;
  /**
   * Descontar esta visita del plan del cliente, si lo hay. Por omisión `true`:
   * es el caso normal, y así los clientes viejos de la API no cambian de
   * comportamiento. En `false` queda como trabajo suelto aunque haya plan.
   */
  cubrirConPlan?: boolean;
}

export interface CreateVisitasBatchPayload {
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
  const itemsCubiertos = await prisma.suscripcionItem.findMany({
    where: {
      productoId: { in: seleccion.map((p) => p.productoId) },
      suscripcion: { clienteId: cliente.id, estado: "ACTIVO" },
    },
    select: { id: true, productoId: true },
  });
  const itemPorProducto = new Map(
    itemsCubiertos.map((i) => [i.productoId, i.id])
  );
  const itemElegido = (p: ProductoDeVisitaInput): string | null =>
    p.cubrirConPlan === false ? null : (itemPorProducto.get(p.productoId) ?? null);

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
          orden: idx,
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
    select: { id: true, clienteId: true },
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
  }

  const productos = seleccion;
  return prisma.$transaction(async (tx) => {
    if (productos) {
      const ids = productos.map((p) => p.productoId);
      // Las fotos etiquetadas con un producto que se quita quedan sin etiqueta.
      await tx.visitaMedia.updateMany({
        where: { visitaId, productoId: { notIn: ids } },
        data: { productoId: null },
      });
      await tx.visitaProducto.deleteMany({
        where: { visitaId, productoId: { notIn: ids } },
      });

      const itemsCubiertos = await tx.suscripcionItem.findMany({
        where: {
          productoId: { in: ids },
          suscripcion: { clienteId: visita.clienteId, estado: "ACTIVO" },
        },
        select: { id: true, productoId: true },
      });
      const itemPorProducto = new Map(
        itemsCubiertos.map((i) => [i.productoId, i.id])
      );

      for (const [idx, p] of productos.entries()) {
        const item =
          p.cubrirConPlan === false
            ? null
            : (itemPorProducto.get(p.productoId) ?? null);
        await tx.visitaProducto.upsert({
          where: { visitaId_productoId: { visitaId, productoId: p.productoId } },
          create: {
            visitaId,
            productoId: p.productoId,
            suscripcionItemId: item,
            orden: idx,
          },
          // El enlace también se actualiza: si no, desmarcar "cubierto" en un
          // producto que ya estaba en la visita no haría nada.
          update: { orden: idx, suscripcionItemId: item },
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
        ...(payload.notas !== undefined ? { notas: payload.notas } : {}),
        updatedById: viewer.id,
      },
    });
  });
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
