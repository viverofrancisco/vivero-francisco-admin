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
  clienteServicio: {
    include: {
      cliente: {
        select: {
          id: true,
          userId: true,
          nombre: true,
          apellido: true,
          telefono: true,
          direccion: true,
          ciudad: true,
          sector: { select: { id: true, nombre: true } },
        },
      },
      servicio: { select: { id: true, nombre: true, tipo: true } },
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
    clienteServicio: {
      cliente: {
        userId: string | null;
        sector: { id: string; nombre: string } | null;
      };
    };
  }
): Promise<void> {
  if (isAdminRole(viewer.role)) return;
  if (viewer.role === "CLIENTE") {
    if (visita.clienteServicio.cliente.userId === viewer.id) return;
    throw new ForbiddenError();
  }
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorId = visita.clienteServicio.cliente.sector?.id ?? null;
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
  servicioId?: string;
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
      clienteServicio: { cliente: { sectorId: { in: sectorIds } } },
    };
  }
  if (viewer.role === "CLIENTE") {
    if (!viewer.clienteId) throw new ForbiddenError();
    return {
      deletedAt: null,
      clienteServicio: { clienteId: viewer.clienteId },
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

  if (filters.clienteId || filters.servicioId) {
    const cs =
      (where.clienteServicio as Record<string, unknown> | undefined) ?? {};
    if (filters.clienteId) cs.clienteId = filters.clienteId;
    if (filters.servicioId) cs.servicioId = filters.servicioId;
    where.clienteServicio = cs;
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
      await tx.visitaMedia.createMany({
        data: media.map((m) => ({
          visitaId,
          key: m.key,
          url: publicUrlForKey(m.key),
          tipo: m.tipo,
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

export interface CreateVisitasBatchPayload {
  clienteServicioId: string;
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

  const clienteServicio = await prisma.clienteServicio.findUnique({
    where: { id: payload.clienteServicioId },
    include: { cliente: { select: { sectorId: true } } },
  });
  if (!clienteServicio || clienteServicio.estado !== "ACTIVO") {
    throw new ValidationError("El servicio asignado no existe o no está activo.");
  }

  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorIds = await getSectorIdsForUser(viewer.id);
    const sectorId = clienteServicio.cliente.sectorId;
    if (!sectorId || !sectorIds.includes(sectorId)) {
      throw new ForbiddenError("No tienes acceso a este cliente.");
    }
  }

  const existing = await prisma.visita.findMany({
    where: {
      clienteServicioId: payload.clienteServicioId,
      fechaProgramada: { in: payload.fechas },
      estado: { not: "CANCELADA" },
      deletedAt: null,
    },
    select: { fechaProgramada: true },
  });
  if (existing.length > 0) {
    const dupes = existing
      .map((e) => e.fechaProgramada.toISOString().split("T")[0])
      .join(", ");
    throw new ConflictError(`Ya existen visitas para estas fechas: ${dupes}`);
  }

  const personalIds = payload.personalIds ?? [];
  const visitas = await prisma.$transaction(
    payload.fechas.map((fecha) =>
      prisma.visita.create({
        data: {
          clienteServicioId: payload.clienteServicioId,
          fechaProgramada: fecha,
          grupoId: payload.grupoId || null,
          notas: payload.notas || null,
          createdById: viewer.id,
          updatedById: viewer.id,
          personal: personalIds.length
            ? {
                create: personalIds.map((pid) => ({
                  personalId: pid,
                  addedById: viewer.id,
                })),
              }
            : undefined,
        },
      })
    )
  );

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

  const visita = await prisma.visita.findFirst({
    where: { id: visitaId, deletedAt: null },
    select: { id: true, estado: true },
  });
  if (!visita) throw new NotFoundError("Visita no encontrada");
  if (visita.estado !== "PROGRAMADA") {
    throw new ConflictError(
      "Solo se puede modificar el personal de visitas programadas."
    );
  }

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

export interface UpdateVisitaInfoPayload {
  grupoId?: string | null;
  notas?: string | null;
}

export async function updateVisitaInfo(
  visitaId: string,
  viewer: Viewer,
  payload: UpdateVisitaInfoPayload
) {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }

  try {
    return await prisma.visita.update({
      where: { id: visitaId },
      data: {
        grupoId: payload.grupoId ?? null,
        notas: payload.notas ?? null,
        updatedById: viewer.id,
      },
    });
  } catch {
    throw new NotFoundError("Visita no encontrada");
  }
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
