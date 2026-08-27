import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { nombreCliente } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { hoyEnEcuador } from "@/lib/fechas";
import {
  s3,
  BUCKET_NAME,
  publicUrlForKey,
  getUploadUrl,
  deleteObjects,
} from "@/lib/s3";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { getVisitaForViewer } from "./visita.service";
import { resumenProductos } from "@/lib/visita-productos";
import { renderInformePDF } from "@/lib/informes/render";
import type {
  InformeRenderData,
  InformeRenderSeccion,
} from "@/lib/informes/template-data";

/**
 * Informes: solo ADMIN y STAFF, para leerlos y para armarlos.
 *
 * Un `PERSONAL_ADMIN` lleva el trabajo de campo de sus sectores —sus clientes,
 * sus visitas, sus mensajes— y no arma ni reparte los informes que se le
 * entregan al cliente. Antes entraba con el alcance de sus sectores; el corte
 * no es "de quién es el cliente" sino "esto sale de la oficina".
 */
function ensureInformes(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) {
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
  // Listar también es ver: sin esta línea el corte quedaba solo en escribir.
  ensureInformes(viewer);

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


  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(0, options.offset ?? 0);

  const [items, total] = await Promise.all([
    prisma.informe.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
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
  ensureInformes(viewer);
  // Authorization piggybacks on viewer being able to see at least one visita
  // of this cliente; we apply the same `clienteId` filter and let the DB
  // do the rest. PERSONAL_ADMIN: also filter by sector match.
  const where: Record<string, unknown> = {
    deletedAt: null,
    clienteId,
    estado: { in: ["COMPLETADA", "INCOMPLETA"] },
  };
  if (options.from || options.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (options.from) range.gte = options.from;
    if (options.to) range.lte = options.to;
    where.fechaProgramada = range;
  }


  const visitas = await prisma.visita.findMany({
    where,
    include: {
      productos: {
        orderBy: { posicion: "asc" },
        include: {
          producto: {
                select: { id: true, nombre: true, descripcion: true },
          },
        },
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
    productos: v.productos.map((vs) => ({
      productoId: vs.producto.id,
      nombre: vs.producto.nombre,
    })),
    servicioNombre: resumenProductos(v),
    fotosCount: v._count.media,
  }));
}

// ──────────────────────────────────────────────
// Wizard paso 2 — servicios disponibles para armar secciones
// ──────────────────────────────────────────────

export interface ServicioParaSeccion {
  productoId: string;
  nombre: string;
  descripcion: string | null;
  /// Cuántas de las visitas seleccionadas incluyen este servicio.
  visitasCount: number;
  /// Fotos de las visitas seleccionadas etiquetadas con este servicio.
  fotosCount: number;
}

/**
 * Union de los servicios cubiertos por las visitas seleccionadas. Cada uno se
 * ofrece como sección: el título sale del nombre del servicio y la descripción
 * de la descripción del servicio.
 */
export async function listServiciosParaInforme(
  viewer: Viewer,
  visitaIds: string[]
): Promise<ServicioParaSeccion[]> {
  ensureInformes(viewer);
  if (visitaIds.length === 0) return [];
  // Verifica que el viewer pueda ver cada visita.
  await Promise.all(visitaIds.map((id) => getVisitaForViewer(id, viewer)));

  const [rows, fotos] = await Promise.all([
    prisma.visitaProducto.findMany({
      where: { visitaId: { in: visitaIds } },
      include: {
        producto: {
              select: { id: true, nombre: true, descripcion: true },
        },
      },
      orderBy: { posicion: "asc" },
    }),
    prisma.visitaMedia.groupBy({
      by: ["productoId"],
      where: {
        visitaId: { in: visitaIds },
        tipo: "imagen",
        productoId: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const fotosPorServicio = new Map(
    fotos.map((f) => [f.productoId, f._count._all])
  );

  const porServicio = new Map<string, ServicioParaSeccion>();
  for (const row of rows) {
    const existente = porServicio.get(row.productoId);
    if (existente) {
      existente.visitasCount += 1;
      continue;
    }
    porServicio.set(row.productoId, {
      productoId: row.producto.id,
      nombre: row.producto.nombre,
      descripcion: row.producto.descripcion,
      visitasCount: 1,
      fotosCount: fotosPorServicio.get(row.productoId) ?? 0,
    });
  }
  return [...porServicio.values()];
}

// ──────────────────────────────────────────────
// Wizard step 2 — pool of photos for selected visitas
// ──────────────────────────────────────────────

export async function getMediaPoolDeVisitas(
  viewer: Viewer,
  visitaIds: string[]
) {
  ensureInformes(viewer);
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
    // Permite que el wizard prellene cada sección con sus fotos etiquetadas.
    productoId: m.productoId,
  }));
}

// ──────────────────────────────────────────────
// Fotos subidas directo a una sección del informe
// ──────────────────────────────────────────────

export interface InformeUploadDescriptor {
  key: string;
  uploadUrl: string;
  url: string;
  contentType: string;
}

/**
 * URLs prefirmadas para subir imágenes propias de un informe (las que no vienen
 * de una visita). El archivo se sube directo a R2 y la sección guarda la key.
 */
export async function requestInformeUploadUrls(
  viewer: Viewer,
  clienteId: string,
  files: Array<{ fileName: string; contentType: string }>
): Promise<InformeUploadDescriptor[]> {
  ensureInformes(viewer);
  if (files.length === 0) return [];

  const invalido = files.find((f) => !f.contentType.startsWith("image/"));
  if (invalido) {
    throw new ValidationError("Solo se pueden subir imágenes a las secciones.");
  }

  return Promise.all(
    files.map(async (f) => {
      const ext = f.fileName.includes(".") ? f.fileName.split(".").pop() : "";
      const key = `informes/${clienteId}/adjuntos/${randomUUID()}${
        ext ? `.${ext}` : ""
      }`;
      const uploadUrl = await getUploadUrl(key, f.contentType);
      return {
        key,
        uploadUrl,
        url: publicUrlForKey(key),
        contentType: f.contentType,
      };
    })
  );
}

// ──────────────────────────────────────────────
// Generate
// ──────────────────────────────────────────────

export interface InformeFirmanteInput {
  nombre: string;
  cedula?: string | null;
}

/**
 * Una foto de una sección: o viene de una visita (`visitaMediaId`) o se subió
 * directo al informe (`key`, ya en R2 vía URL prefirmada). Exactamente una.
 */
export interface InformeSeccionFotoInput {
  visitaMediaId?: string | null;
  key?: string | null;
}

/**
 * Lo que hace falta para armar un informe. **No** lleva el id de uno
 * existente: un informe no se edita.
 *
 * Es un documento firmado que ya salió: si dice algo que no era, lo que
 * corresponde es eliminarlo y hacer el correcto, no reescribirlo por debajo
 * dejando al cliente con un PDF que ya no coincide con el nuestro.
 */
export interface InformeGeneratePayload {
  clienteId: string;
  titulo: string;
  /**
   * La que sale impresa, `YYYY-MM-DD`. Sin esto, el día de hoy.
   *
   * Un informe de agosto puede armarse el 2 de septiembre y tiene que decir
   * agosto; y regenerarlo para corregir una foto no le cambia la fecha al
   * documento que el cliente ya tiene.
   */
  fecha?: string;
  visitaIds: string[];
  firmantes: InformeFirmanteInput[]; // 1 to 3
  secciones: Array<{
    /// Servicio que origina la sección. Null = sección personalizada.
    productoId?: string | null;
    titulo: string;
    descripcion?: string | null;
    fotos: InformeSeccionFotoInput[];
  }>;
}

/** Foto ya resuelta a bytes + metadatos, lista para el PDF y para persistir. */
interface FotoResuelta {
  key: string;
  url: string;
  visitaMediaId: string | null;
}

export async function generateInforme(
  viewer: Viewer,
  payload: InformeGeneratePayload
) {
  ensureInformes(viewer);

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
    if (v.cliente.id !== payload.clienteId) {
      throw new ValidationError("Una de las visitas no pertenece al cliente.");
    }
  }

  // Las secciones basadas en un servicio tienen que apuntar a un servicio del
  // cliente; las personalizadas van sin servicio.
  const seccionServicioIds = [
    ...new Set(
      payload.secciones
        .map((sec) => sec.productoId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (seccionServicioIds.length > 0) {
    const validos = await prisma.producto.count({
      where: { id: { in: seccionServicioIds }, deletedAt: null },
    });
    if (validos !== seccionServicioIds.length) {
      throw new ValidationError(
        "Alguna sección apunta a un producto que no existe."
      );
    }
  }

  // Las fotos que vienen de una visita tienen que ser de las visitas elegidas.
  const visitaMediaIds = [
    ...new Set(
      payload.secciones
        .flatMap((sec) => sec.fotos)
        .map((f) => f.visitaMediaId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const visitaMedia = visitaMediaIds.length
    ? await prisma.visitaMedia.findMany({
        where: { id: { in: visitaMediaIds }, visitaId: { in: payload.visitaIds } },
        select: { id: true, key: true, url: true },
      })
    : [];
  if (visitaMedia.length !== visitaMediaIds.length) {
    throw new ValidationError(
      "Algunos archivos referenciados no pertenecen a las visitas seleccionadas."
    );
  }
  const visitaMediaById = new Map(visitaMedia.map((m) => [m.id, m]));

  // Resuelve cada foto de cada sección a { key, url, visitaMediaId }.
  const seccionesResueltas = payload.secciones.map((sec) => ({
    ...sec,
    fotos: sec.fotos
      .map((f): FotoResuelta | null => {
        if (f.visitaMediaId) {
          const m = visitaMediaById.get(f.visitaMediaId);
          return m
            ? { key: m.key, url: m.url, visitaMediaId: m.id }
            : null;
        }
        if (f.key) {
          return {
            key: f.key,
            url: publicUrlForKey(f.key),
            visitaMediaId: null,
          };
        }
        return null;
      })
      .filter((f): f is FotoResuelta => f !== null),
  }));

  // Resolve fechaDesde/fechaHasta from visita range.
  const fechas = visitas.map(
    (v) =>
      (v as unknown as { fechaProgramada: Date }).fechaProgramada
  );
  fechas.sort((a, b) => a.getTime() - b.getTime());
  const fechaDesde = fechas[0];
  const fechaHasta = fechas[fechas.length - 1];

  // Descarga los bytes de cada foto una sola vez, cacheando por key.
  const fotosCache = new Map<string, { bytes: Uint8Array; mimeType: string }>();
  for (const sec of seccionesResueltas) {
    for (const foto of sec.fotos) {
      if (fotosCache.has(foto.key)) continue;
      const res = await fetch(foto.url);
      if (!res.ok) {
        throw new ValidationError(`No pudimos descargar la foto ${foto.key}.`);
      }
      const mimeType = res.headers.get("content-type") ?? "image/jpeg";
      const arrayBuffer = await res.arrayBuffer();
      fotosCache.set(foto.key, {
        bytes: new Uint8Array(arrayBuffer),
        mimeType,
      });
    }
  }

  // Build render data.
  const cliente = await prisma.cliente.findUnique({
    where: { id: payload.clienteId },
    select: { nombre: true, apellido: true, empresa: true },
  });
  const subtituloDefault = cliente
    ? `ACTIVIDADES REALIZADAS PARA ${nombreCliente(cliente).toUpperCase()}`
    : "ACTIVIDADES REALIZADAS";

  const renderSecciones: InformeRenderSeccion[] = seccionesResueltas.map(
    (sec) => ({
      titulo: sec.titulo,
      descripcion: sec.descripcion?.trim() || null,
      fotos: sec.fotos
        .map((foto) => {
          const cached = fotosCache.get(foto.key);
          if (!cached) return null;
          return {
            id: foto.key,
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
      } else {
        // Sin esto el informe sale sin logo ni marca de agua y nadie se
        // entera: la falta de logo no rompe nada, y el PDF se ve "bien" hasta
        // que alguien lo compara con uno viejo. Pasó cuando el logo quedó
        // apuntando a un bucket que ya no existía.
        console.warn(
          `Logo de la empresa: ${res.status} al bajar ${empresaCfg.logoUrl}. ` +
            `El informe sale sin logo; volvé a subirlo en Configuración → Empresa.`
        );
      }
    } catch (err) {
      console.warn("Failed to fetch empresa logo for PDF", err);
    }
  }

  // Mediodía UTC y no medianoche: en Ecuador (UTC-5) medianoche cae el día
  // anterior, y el PDF saldría con la fecha corrida.
  const fechaImpresa = payload.fecha
    ? new Date(`${payload.fecha}T12:00:00.000Z`)
    : hoyEnEcuador();

  const renderData: InformeRenderData = {
    fecha: fechaImpresa,
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

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.informe.create({
      data: {
        clienteId: payload.clienteId,
        titulo: payload.titulo,
        fecha: fechaImpresa,
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
          create: seccionesResueltas.map((sec, idx) => ({
            productoId: sec.productoId ?? null,
            titulo: sec.titulo,
            descripcion: sec.descripcion?.trim() || null,
            orden: idx * 10,
            fotos: {
              create: sec.fotos.map((foto, fIdx) => ({
                orden: fIdx,
                key: foto.key,
                url: foto.url,
                visitaMediaId: foto.visitaMediaId,
              })),
            },
          })),
        },
      },
    });
    return created;
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
        select: { id: true, nombre: true, apellido: true, empresa: true, sectorId: true },
      },
      generatedBy: {
        select: { id: true, name: true, apellido: true },
      },
      visitas: {
        select: {
          visitaId: true,
          // La ficha del informe las lista para poder saltar a cada una.
          visita: {
            select: {
              id: true,
              numero: true,
              estado: true,
              fechaProgramada: true,
              fechaRealizada: true,
            },
          },
        },
      },
      secciones: {
        orderBy: { orden: "asc" },
        include: {
          producto: { select: { id: true, nombre: true } },
          fotos: { orderBy: { orden: "asc" } },
        },
      },
    },
  });
  if (!informe) throw new NotFoundError();
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
  return informe;
}

export async function deleteInforme(viewer: Viewer, id: string) {
  ensureInformes(viewer);

  /**
   * Qué archivos son de este informe y de nadie más.
   *
   * El PDF, siempre. Y las fotos que se subieron **al informe**: las que
   * vienen de una visita (`visitaMediaId`) son de la visita, siguen en su
   * ficha y borrarlas dejaría esa galería con huecos.
   */
  const informe = await prisma.informe.findUnique({
    where: { id },
    select: {
      pdfKey: true,
      secciones: {
        select: {
          fotos: { where: { visitaMediaId: null }, select: { key: true } },
        },
      },
    },
  });
  if (!informe) throw new NotFoundError("Informe no encontrado");

  // La fila primero: es la fuente de verdad. Si después falla R2 sobra un
  // archivo; al revés quedaría un informe con el PDF ya borrado.
  await prisma.informe.delete({ where: { id } });

  await deleteObjects([
    informe.pdfKey,
    ...informe.secciones.flatMap((s) => s.fotos.map((f) => f.key)),
  ]);
}
