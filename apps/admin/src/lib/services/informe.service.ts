import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { s3, BUCKET_NAME, publicUrlForKey } from "@/lib/s3";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { getVisitaForViewer } from "./visita.service";
import { renderInformePDF } from "@/lib/informes/render";
import type {
  InformeRenderData,
  InformeRenderSeccion,
} from "@/lib/informes/template-data";

function ensureInformeWriter(viewer: Viewer): void {
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    throw new ForbiddenError();
  }
}

// ──────────────────────────────────────────────
// List informes
// ──────────────────────────────────────────────

export async function listInformes(
  viewer: Viewer,
  options: {
    clienteId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  } = {}
) {
  // PERSONAL_ADMIN: solo informes cuyos clientes están en sus sectores.
  const where: Record<string, unknown> = {};
  if (options.clienteId) where.clienteId = options.clienteId;
  if (options.from || options.to) {
    const range: { gte?: Date; lt?: Date } = {};
    if (options.from) range.gte = options.from;
    if (options.to) {
      // Make `to` inclusive of the whole day.
      const next = new Date(options.to);
      next.setUTCDate(next.getUTCDate() + 1);
      range.lt = next;
    }
    where.generatedAt = range;
  }
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorAdmins = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    const sectorIds = sectorAdmins.map((s) => s.sectorId);
    where.cliente = { sectorId: { in: sectorIds } };
  }

  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(0, options.offset ?? 0);

  const [items, total] = await Promise.all([
    prisma.informe.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true } },
        generatedBy: { select: { id: true, name: true, apellido: true } },
        _count: { select: { visitas: true } },
      },
      orderBy: { generatedAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.informe.count({ where }),
  ]);

  return {
    items,
    total,
    limit,
    offset,
  };
}

// ──────────────────────────────────────────────
// Wizard step 1 — list candidate visitas
// ──────────────────────────────────────────────

export async function listVisitasParaInforme(
  viewer: Viewer,
  clienteId: string,
  options: { from?: Date; to?: Date } = {}
) {
  ensureInformeWriter(viewer);
  // Authorization piggybacks on viewer being able to see at least one visita
  // of this cliente; we apply the same `clienteId` filter and let the DB
  // do the rest. PERSONAL_ADMIN: also filter by sector match.
  const where: Record<string, unknown> = {
    deletedAt: null,
    clienteServicio: { clienteId },
    estado: { in: ["COMPLETADA", "INCOMPLETA"] },
  };
  if (options.from || options.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (options.from) range.gte = options.from;
    if (options.to) range.lte = options.to;
    where.fechaProgramada = range;
  }
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorAdmins = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    const sectorIds = sectorAdmins.map((s) => s.sectorId);
    where.clienteServicio = {
      clienteId,
      cliente: { sectorId: { in: sectorIds } },
    };
  }

  const visitas = await prisma.visita.findMany({
    where,
    include: {
      clienteServicio: {
        select: { servicio: { select: { id: true, nombre: true } } },
      },
      _count: { select: { media: true } },
    },
    orderBy: { fechaProgramada: "asc" },
  });

  return visitas.map((v) => ({
    id: v.id,
    fechaProgramada: v.fechaProgramada,
    fechaRealizada: v.fechaRealizada,
    estado: v.estado,
    servicioNombre: v.clienteServicio.servicio.nombre,
    fotosCount: v._count.media,
  }));
}

// ──────────────────────────────────────────────
// Wizard step 2 — pool of photos for selected visitas
// ──────────────────────────────────────────────

export async function getMediaPoolDeVisitas(
  viewer: Viewer,
  visitaIds: string[]
) {
  ensureInformeWriter(viewer);
  if (visitaIds.length === 0) return [];
  // Verify viewer can see each visita.
  await Promise.all(
    visitaIds.map((id) => getVisitaForViewer(id, viewer))
  );

  const media = await prisma.visitaMedia.findMany({
    where: {
      visitaId: { in: visitaIds },
      tipo: "imagen",
    },
    include: {
      visita: { select: { id: true, fechaProgramada: true } },
    },
    orderBy: [{ visita: { fechaProgramada: "asc" } }, { createdAt: "asc" }],
  });

  return media.map((m) => ({
    id: m.id,
    url: m.url,
    visitaId: m.visitaId,
    visitaFecha: m.visita.fechaProgramada,
  }));
}

// ──────────────────────────────────────────────
// Generate
// ──────────────────────────────────────────────

export interface InformeFirmanteInput {
  nombre: string;
  cedula?: string | null;
}

export interface InformeGeneratePayload {
  informeId?: string; // if present = update existing
  clienteId: string;
  titulo: string;
  visitaIds: string[];
  firmantes: InformeFirmanteInput[]; // 1 to 3
  secciones: Array<{
    tipoActividadId?: string | null;
    titulo: string;
    descripcion?: string | null;
    mediaIds: string[];
  }>;
}

export async function generateInforme(
  viewer: Viewer,
  payload: InformeGeneratePayload
) {
  ensureInformeWriter(viewer);

  if (payload.visitaIds.length === 0) {
    throw new ValidationError("Selecciona al menos una visita.");
  }
  if (payload.secciones.length === 0) {
    throw new ValidationError("Agrega al menos una sección al informe.");
  }
  const firmantesNormalizados = (payload.firmantes ?? [])
    .map((f) => ({
      nombre: f.nombre.trim(),
      cedula: (f.cedula ?? "").trim() || null,
    }))
    .filter((f) => f.nombre.length > 0)
    .slice(0, 3);
  if (firmantesNormalizados.length === 0) {
    throw new ValidationError("Agrega al menos un firmante.");
  }

  // Authorization check on each visita.
  const visitas = await Promise.all(
    payload.visitaIds.map((id) => getVisitaForViewer(id, viewer))
  );
  // Make sure all visitas belong to the same cliente in the payload.
  for (const v of visitas) {
    const cs = (v as unknown as { clienteServicio: { cliente: { id: string } } })
      .clienteServicio;
    if (cs.cliente.id !== payload.clienteId) {
      throw new ValidationError("Una de las visitas no pertenece al cliente.");
    }
  }

  // Validate media IDs all belong to selected visitas.
  const allMediaIds = payload.secciones.flatMap((s) => s.mediaIds);
  if (allMediaIds.length > 0) {
    const validMedia = await prisma.visitaMedia.findMany({
      where: { id: { in: allMediaIds }, visitaId: { in: payload.visitaIds } },
      select: { id: true, url: true, tipo: true },
    });
    if (validMedia.length !== allMediaIds.length) {
      throw new ValidationError(
        "Algunos archivos referenciados no pertenecen a las visitas seleccionadas."
      );
    }
  }

  // Resolve fechaDesde/fechaHasta from visita range.
  const fechas = visitas.map(
    (v) =>
      (v as unknown as { fechaProgramada: Date }).fechaProgramada
  );
  fechas.sort((a, b) => a.getTime() - b.getTime());
  const fechaDesde = fechas[0];
  const fechaHasta = fechas[fechas.length - 1];

  // Hydrate media bytes.
  const allMedia = allMediaIds.length
    ? await prisma.visitaMedia.findMany({
        where: { id: { in: allMediaIds } },
        select: { id: true, url: true },
      })
    : [];
  const mediaById = new Map(allMedia.map((m) => [m.id, m]));

  const fotosCache = new Map<string, { bytes: Uint8Array; mimeType: string }>();
  for (const m of allMedia) {
    if (fotosCache.has(m.id)) continue;
    const res = await fetch(m.url);
    if (!res.ok) {
      throw new ValidationError(`No pudimos descargar la foto ${m.id}.`);
    }
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();
    fotosCache.set(m.id, {
      bytes: new Uint8Array(arrayBuffer),
      mimeType,
    });
  }

  // Build render data.
  const cliente = await prisma.cliente.findUnique({
    where: { id: payload.clienteId },
    select: { nombre: true, apellido: true },
  });
  const subtituloDefault = cliente
    ? `ACTIVIDADES REALIZADAS PARA ${(`${cliente.nombre} ${cliente.apellido ?? ""}`)
        .trim()
        .toUpperCase()}`
    : "ACTIVIDADES REALIZADAS";

  const renderSecciones: InformeRenderSeccion[] = payload.secciones.map(
    (sec) => ({
      titulo: sec.titulo,
      descripcion: sec.descripcion?.trim() || null,
      fotos: sec.mediaIds
        .map((id) => {
          const cached = fotosCache.get(id);
          const meta = mediaById.get(id);
          if (!cached || !meta) return null;
          return {
            id,
            bytes: cached.bytes,
            mimeType: cached.mimeType,
          };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null),
    })
  );

  // Optional company logo from EmpresaConfig.
  const empresaCfg = await prisma.empresaConfig.findUnique({
    where: { id: "default" },
    select: { logoUrl: true },
  });
  let logo: { bytes: Uint8Array; format: "png" | "jpg" } | null = null;
  if (empresaCfg?.logoUrl) {
    try {
      const res = await fetch(empresaCfg.logoUrl);
      if (res.ok) {
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        const buf = new Uint8Array(await res.arrayBuffer());
        // @react-pdf/renderer supports png and jpg via the data buffer API.
        const format: "png" | "jpg" = ct.includes("png") ? "png" : "jpg";
        logo = { bytes: buf, format };
      }
    } catch (err) {
      console.warn("Failed to fetch empresa logo for PDF", err);
    }
  }

  const renderData: InformeRenderData = {
    fecha: new Date(),
    titulo: payload.titulo.toUpperCase(),
    subtitulo: subtituloDefault,
    secciones: renderSecciones,
    firmantes: firmantesNormalizados,
    logo,
  };

  const pdfBuffer = await renderInformePDF(renderData);

  // Upload to R2.
  const pdfKey = `informes/${payload.clienteId}/${randomUUID()}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  const pdfUrl = publicUrlForKey(pdfKey);

  // Persist (or update) in a transaction.
  const result = await prisma.$transaction(async (tx) => {
    if (payload.informeId) {
      // Update path
      await tx.informeVisita.deleteMany({
        where: { informeId: payload.informeId },
      });
      await tx.informeSeccion.deleteMany({
        where: { informeId: payload.informeId },
      });
      const updated = await tx.informe.update({
        where: { id: payload.informeId },
        data: {
          clienteId: payload.clienteId,
          titulo: payload.titulo,
          fechaDesde,
          fechaHasta,
          pdfKey,
          pdfUrl,
          firmantes: firmantesNormalizados,
          // generatedById intentionally left as the original creator. Could
          // also overwrite it; leaving as audit detail.
        },
      });
      await tx.informeVisita.createMany({
        data: payload.visitaIds.map((vid) => ({
          informeId: updated.id,
          visitaId: vid,
        })),
      });
      await tx.informeSeccion.createMany({
        data: payload.secciones.map((s, idx) => ({
          informeId: updated.id,
          tipoActividadId: s.tipoActividadId ?? null,
          titulo: s.titulo,
          descripcion: s.descripcion?.trim() || null,
          orden: idx * 10,
          mediaIds: s.mediaIds,
        })),
      });
      return updated;
    } else {
      const created = await tx.informe.create({
        data: {
          clienteId: payload.clienteId,
          titulo: payload.titulo,
          fechaDesde,
          fechaHasta,
          pdfKey,
          pdfUrl,
          firmantes: firmantesNormalizados,
          generatedById: viewer.id,
          visitas: {
            create: payload.visitaIds.map((vid) => ({ visitaId: vid })),
          },
          secciones: {
            create: payload.secciones.map((s, idx) => ({
              tipoActividadId: s.tipoActividadId ?? null,
              titulo: s.titulo,
              descripcion: s.descripcion?.trim() || null,
              orden: idx * 10,
              mediaIds: s.mediaIds,
            })),
          },
        },
      });
      return created;
    }
  });

  return { id: result.id, pdfUrl };
}

// ──────────────────────────────────────────────
// Get / delete
// ──────────────────────────────────────────────

export async function getInforme(viewer: Viewer, id: string) {
  const informe = await prisma.informe.findUnique({
    where: { id },
    include: {
      cliente: {
        select: { id: true, nombre: true, apellido: true, sectorId: true },
      },
      generatedBy: {
        select: { id: true, name: true, apellido: true },
      },
      visitas: { select: { visitaId: true } },
      secciones: { orderBy: { orden: "asc" } },
    },
  });
  if (!informe) throw new NotFoundError();
  // PERSONAL_ADMIN may only read informes whose cliente is in their sectors.
  if (viewer.role === "PERSONAL_ADMIN") {
    const sectorAdmins = await prisma.sectorAdmin.findMany({
      where: { userId: viewer.id },
      select: { sectorId: true },
    });
    const sectorIds = sectorAdmins.map((s) => s.sectorId);
    if (
      !informe.cliente.sectorId ||
      !sectorIds.includes(informe.cliente.sectorId)
    ) {
      throw new ForbiddenError();
    }
  } else if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
  return informe;
}

export async function deleteInforme(viewer: Viewer, id: string) {
  ensureInformeWriter(viewer);
  // Cascade deletes the join + secciones rows. The PDF in R2 stays as
  // orphan for now (cleanup can be a fast-follow cron).
  await prisma.informe.delete({ where: { id } });
}
