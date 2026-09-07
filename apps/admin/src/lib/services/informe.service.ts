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
import { bajarFotos, bajarLogo } from "@/lib/informes/fotos";
import type {
  FotosPorFila,
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
 * Una foto de una sección: viene de una visita, de la biblioteca, o se subió
 * directo al informe (`key`, ya en R2 vía URL prefirmada). Exactamente una.
 */
export interface InformeSeccionFotoInput {
  visitaMediaId?: string | null;
  /** De la biblioteca. Es por donde entran las nuevas. */
  mediaId?: string | null;
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
    /// Cómo se imprime. Ausentes = lo que se venía imprimiendo.
    saltoDePagina?: boolean;
    fotosPorFila?: FotosPorFila;
  }>;
}

/** Foto ya resuelta a bytes + metadatos, lista para el PDF y para persistir. */
interface FotoResuelta {
  key: string;
  url: string;
  visitaMediaId: string | null;
  /** De la biblioteca. Decide quién es dueño del archivo, o sea quién lo borra. */
  mediaId: string | null;
}

/**
 * Todo lo que hace falta para dibujar el PDF: validado, resuelto y con las
 * fotos ya bajadas.
 *
 * Está separado de `generateInforme` porque la vista previa necesita
 * exactamente esto y nada de lo que viene después —subir a R2, escribir las
 * filas—. Si fueran dos armados distintos, la vista previa mostraría un
 * documento que no es el que se va a guardar, que es peor que no tenerla.
 */
async function armarDatosDelInforme(
  viewer: Viewer,
  payload: InformeGeneratePayload,
  /**
   * Borrador = las fotos van achicadas al tamaño impreso y cacheadas. El corte
   * de páginas es idéntico —depende del alto en puntos, no de los píxeles del
   * archivo— así que lo que se ve es lo que va a salir; lo único que cambia es
   * la resolución, que en pantalla no se nota y en tiempo es todo.
   */
  { borrador }: { borrador: boolean }
) {
  ensureInformes(viewer);

  // Sin visitas se puede: un informe es un documento, y hay documentos que no
  // salen de una visita. Lo que sí necesita es contenido, que es lo de abajo.
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

  // Las de la biblioteca, para poder resolver su `key`. Se piden por id y no
  // se confía en la `key` que venga del cliente: si no, un pedido armado a mano
  // metería en el informe cualquier archivo del bucket.
  const mediaIds = [
    ...new Set(
      payload.secciones
        .flatMap((s) => s.fotos)
        .map((f) => f.mediaId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const media = mediaIds.length
    ? await prisma.media.findMany({
        where: { id: { in: mediaIds } },
        select: { id: true, key: true },
      })
    : [];
  const mediaById = new Map(media.map((m) => [m.id, m]));

  // Resuelve cada foto a { key, url } más de dónde vino.
  const seccionesResueltas = payload.secciones.map((sec) => ({
    ...sec,
    fotos: sec.fotos
      .map((f): FotoResuelta | null => {
        if (f.visitaMediaId) {
          const m = visitaMediaById.get(f.visitaMediaId);
          return m
            ? { key: m.key, url: m.url, visitaMediaId: m.id, mediaId: null }
            : null;
        }
        if (f.mediaId) {
          const m = mediaById.get(f.mediaId);
          return m
            ? {
                key: m.key,
                url: publicUrlForKey(m.key),
                visitaMediaId: null,
                mediaId: m.id,
              }
            : null;
        }
        if (f.key) {
          return {
            key: f.key,
            url: publicUrlForKey(f.key),
            visitaMediaId: null,
            mediaId: null,
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

  // Los bytes de cada foto, una sola vez. En borrador salen achicadas y quedan
  // cacheadas, que es lo que hace posible mirar la previa mientras se edita.
  let fotosCache: Map<string, { bytes: Uint8Array; mimeType: string }>;
  try {
    fotosCache = await bajarFotos(
      seccionesResueltas.flatMap((sec) => sec.fotos),
      { borrador }
    );
  } catch (e) {
    throw new ValidationError(
      e instanceof Error ? e.message : "No pudimos descargar las fotos."
    );
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
      saltoDePagina: sec.saltoDePagina ?? false,
      fotosPorFila: sec.fotosPorFila ?? 3,
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
      logo = await bajarLogo(empresaCfg.logoUrl);
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

  return {
    renderData,
    seccionesResueltas,
    firmantesNormalizados,
    fechaImpresa,
    fechaDesde,
    fechaHasta,
  };
}

/**
 * El PDF tal como saldría, sin guardar nada.
 *
 * Es el mismo camino que `generateInforme` hasta el render, así que lo que se
 * ve es lo que se va a archivar. Sirve para decidir el layout —cuántas fotos
 * por fila, qué sección arranca en hoja nueva— que es una decisión que no se
 * puede tomar a ciegas.
 */
export async function previsualizarInforme(
  viewer: Viewer,
  payload: InformeGeneratePayload,
  opciones: { borrador?: boolean } = {}
): Promise<Buffer> {
  const { renderData } = await armarDatosDelInforme(viewer, payload, {
    borrador: opciones.borrador ?? false,
  });
  return renderInformePDF(renderData);
}

export async function generateInforme(
  viewer: Viewer,
  payload: InformeGeneratePayload
) {
  const {
    renderData,
    seccionesResueltas,
    firmantesNormalizados,
    fechaImpresa,
    fechaDesde,
    fechaHasta,
  } = await armarDatosDelInforme(viewer, payload, { borrador: false });

  // Acá y no al armar los datos: es un requisito del documento que se emite, no
  // de dibujarlo. La vista previa se mira antes de llegar al paso de la firma, y
  // exigirlo ahí la dejaría en blanco justo cuando sirve.
  if (firmantesNormalizados.length === 0) {
    throw new ValidationError("Agrega al menos un firmante.");
  }

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
            // Se guarda aunque el PDF ya esté hecho: es lo que explica por qué
            // salió así, y lo que un "duplicar informe" necesitaría leer.
            saltoDePagina: sec.saltoDePagina ?? false,
            fotosPorFila: sec.fotosPorFila ?? 3,
            fotos: {
              create: sec.fotos.map((foto, fIdx) => ({
                orden: fIdx,
                key: foto.key,
                mediaId: foto.mediaId,
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
   * El PDF, siempre. De las fotos, **ninguna que tenga dueño**:
   *
   * - con `visitaMediaId`, el archivo es de la visita y borrarlo dejaría esa
   *   galería con huecos;
   * - con `mediaId`, es de la biblioteca y puede estar en un producto o en
   *   otro informe.
   *
   * Quedan las viejas, subidas cuando el informe era el único dueño de su
   * archivo. Desde que las fotos pasan por la biblioteca no se crean más, así
   * que este caso se va apagando solo.
   */
  const informe = await prisma.informe.findUnique({
    where: { id },
    select: {
      pdfKey: true,
      secciones: {
        select: {
          fotos: {
            where: { visitaMediaId: null, mediaId: null },
            select: { key: true },
          },
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

/**
 * Cambia qué visitas cubre un informe ya generado.
 *
 * **No contradice que el informe sea inmutable.** Lo que no se toca es el
 * documento: su título, sus secciones, sus fotos y el PDF que el cliente ya
 * tiene. Las visitas no salen impresas —el renderizador ni las mira— son el
 * vínculo con el trabajo que el informe cuenta, y ese vínculo se corrige:
 * alguien marcó una visita de más, o faltó la del martes.
 *
 * Reemplaza el conjunto entero, como todo lo que se guarda desde una pantalla:
 * lo que llega es el estado final.
 */
export async function actualizarVisitasDelInforme(
  viewer: Viewer,
  informeId: string,
  visitaIds: string[]
) {
  ensureInformes(viewer);

  const informe = await prisma.informe.findUnique({
    where: { id: informeId },
    select: { id: true, clienteId: true },
  });
  if (!informe) throw new NotFoundError("Informe no encontrado");

  // Cada visita, con el mismo permiso que en cualquier otro lado, y del mismo
  // cliente: sin esto un id a mano metería el trabajo de otro en este informe.
  // Que el informe sea visible lo garantiza `getInforme` al devolverlo.
  const visitas = await Promise.all(
    visitaIds.map((id) => getVisitaForViewer(id, viewer))
  );
  for (const v of visitas) {
    if (v.cliente.id !== informe.clienteId) {
      throw new ValidationError("Una de las visitas no es de este cliente.");
    }
  }

  await prisma.$transaction([
    prisma.informeVisita.deleteMany({ where: { informeId } }),
    ...(visitaIds.length > 0
      ? [
          prisma.informeVisita.createMany({
            data: visitaIds.map((visitaId) => ({ informeId, visitaId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return getInforme(viewer, informeId);
}
