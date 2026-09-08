import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { nombreCliente } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  esSoloNumero,
  numeroBuscado,
  palabrasParaIlike,
} from "./busqueda";
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
import {
  encabezadoPorDefecto,
  parsearEncabezado,
  tituloDelEncabezado,
} from "@/lib/informes/encabezado";
import { sanitizarEncabezado } from "@/lib/html-seguro";
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

/** Qué se está mirando en la lista. */
export type EstadoInformeFiltro = "borrador" | "emitido";

/**
 * La lista de informes **con los borradores adentro**, ordenada por fecha.
 *
 * Son dos tablas y esto es lo que obliga a la unión en SQL: si cada una se
 * paginara por su lado, un borrador de ayer aparecería arriba de un informe de
 * hoy o directamente en otra página. Se ordena por lo que cada uno tiene de
 * "cuándo": el informe por cuándo se generó, el borrador por cuándo se tocó por
 * última vez, que es lo que contesta "¿en qué venía trabajando?".
 *
 * La unión trae **solo id y fecha** y después se hidrata cada lado por id: el
 * orden y el corte de página los tiene que resolver la base, pero las columnas
 * las sabe Prisma.
 */
export async function listInformesYBorradores(
  viewer: Viewer,
  options: {
    clienteId?: string;
    /** Texto libre: nombre del cliente o título del informe. */
    q?: string;
    from?: Date;
    to?: Date;
    estado?: EstadoInformeFiltro;
    limit?: number;
    offset?: number;
  } = {}
) {
  ensureInformes(viewer);

  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  const offset = Math.max(0, options.offset ?? 0);
  const { clienteId, from, estado } = options;
  // El buscador reemplaza al desplegable de clientes: se escribe el nombre en
  // vez de encontrarlo en una lista de doscientos. Va contra la base y no
  // sobre la página traída, porque la lista está paginada y filtrar acá
  // buscaría solo dentro de los veinte que se están viendo.
  // Palabra por palabra contra el cliente **y** el título juntos: así "Maria
  // Luisa" encuentra tanto a quien se llama así como a Maria de apellido
  // Luisa, y "Maria poda" encuentra el informe de poda de Maria. La frase
  // entera contra cada campo dejaba afuera el caso más común de todos, el
  // nombre y apellido escritos como uno los dice.
  const palabras = esSoloNumero(options.q) ? [] : palabrasParaIlike(options.q);
  // El mismo campo entiende el número del informe, con o sin `#`: es como se
  // lo nombra. Con OR y no en su lugar, porque un título puede tener un año o
  // un número adentro y esa búsqueda tiene que seguir andando.
  const numero = numeroBuscado(options.q);
  /** Los alias son constantes de esta consulta, no entra nada de afuera. */
  const buscaEn = (cliente: string, tabla: string) => {
    const condiciones: Prisma.Sql[] = [];
    if (numero !== null) {
      condiciones.push(
        Prisma.sql`${Prisma.raw(`${tabla}."numero"`)} = ${numero}`
      );
    }
    if (palabras.length > 0) {
      // Todas las palabras, contra el cliente y el título juntos.
      condiciones.push(
        Prisma.sql`(${Prisma.join(
          palabras.map(
            (palabra) =>
              Prisma.sql`concat_ws(' ', ${Prisma.raw(
                `${cliente}."nombre", ${cliente}."apellido", ${cliente}."empresa", ${tabla}."titulo"`
              )}) ILIKE ${palabra}`
          ),
          " AND "
        )})`
      );
    }
    if (condiciones.length === 0) return Prisma.empty;
    return Prisma.sql`AND (${Prisma.join(condiciones, " OR ")})`;
  };
  // `to` inclusive del día entero.
  const to = options.to
    ? new Date(new Date(options.to).setUTCDate(options.to.getUTCDate() + 1))
    : undefined;

  const filas = await prisma.$queryRaw<
    Array<{ id: string; tipo: string; fecha: Date; total: bigint }>
  >`
    WITH todo AS (
      SELECT i."id", 'emitido' AS tipo, i."generatedAt" AS fecha
      FROM "Informe" i
      JOIN "Cliente" ci ON ci."id" = i."clienteId"
      WHERE (${clienteId}::text IS NULL OR i."clienteId" = ${clienteId})
        AND (${from}::timestamp IS NULL OR i."generatedAt" >= ${from})
        AND (${to}::timestamp IS NULL OR i."generatedAt" < ${to})
        AND (${estado}::text IS NULL OR ${estado} = 'emitido')
        ${buscaEn("ci", "i")}
      UNION ALL
      -- LEFT JOIN: un borrador puede no tener cliente todavía, y esconderlo
      -- del listado lo dejaría sin manera de retomarse.
      SELECT b."id", 'borrador' AS tipo, b."updatedAt" AS fecha
      FROM "InformeBorrador" b
      LEFT JOIN "Cliente" cb ON cb."id" = b."clienteId"
      WHERE (${clienteId}::text IS NULL OR b."clienteId" = ${clienteId})
        AND (${from}::timestamp IS NULL OR b."updatedAt" >= ${from})
        AND (${to}::timestamp IS NULL OR b."updatedAt" < ${to})
        AND (${estado}::text IS NULL OR ${estado} = 'borrador')
        ${buscaEn("cb", "b")}
    )
    SELECT "id", tipo, fecha, COUNT(*) OVER () AS total
    FROM todo
    ORDER BY fecha DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const total = filas.length > 0 ? Number(filas[0].total) : 0;
  const idsInformes = filas.filter((f) => f.tipo === "emitido").map((f) => f.id);
  const idsBorradores = filas
    .filter((f) => f.tipo === "borrador")
    .map((f) => f.id);

  const [informes, borradores] = await Promise.all([
    idsInformes.length
      ? prisma.informe.findMany({
          where: { id: { in: idsInformes } },
          select: {
            id: true,
            numero: true,
            titulo: true,
            pdfUrl: true,
            generatedAt: true,
            versionActual: true,
            cliente: {
              select: { id: true, nombre: true, apellido: true, empresa: true },
            },
          },
        })
      : [],
    idsBorradores.length
      ? prisma.informeBorrador.findMany({
          where: { id: { in: idsBorradores } },
          select: {
            id: true,
            numero: true,
            titulo: true,
            updatedAt: true,
            updatedByNombre: true,
            informeId: true,
            // El número del informe que se está editando: es lo que hace que la
            // fila diga "edición del #12" y no un borrador suelto más.
            informe: { select: { numero: true } },
            cliente: {
              select: { id: true, nombre: true, apellido: true, empresa: true },
            },
          },
        })
      : [],
  ]);

  const porId = new Map<string, (typeof informes)[number]>(
    informes.map((i) => [i.id, i])
  );
  const borradorPorId = new Map<string, (typeof borradores)[number]>(
    borradores.map((b) => [b.id, b])
  );

  // El orden lo mandó la unión; acá solo se rellena.
  const items = filas
    .map((f) =>
      f.tipo === "emitido"
        ? { tipo: "emitido" as const, informe: porId.get(f.id) }
        : { tipo: "borrador" as const, borrador: borradorPorId.get(f.id) }
    )
    .filter(
      (x) =>
        (x.tipo === "emitido" && x.informe) ||
        (x.tipo === "borrador" && x.borrador)
    );

  return { items, total, limit, offset };
}

/** Una foto de una sección, con la url resuelta para poder dibujarla. */
export interface FotoDeVersion {
  visitaMediaId: string | null;
  mediaId: string | null;
  url: string;
}

/**
 * Con qué se armó una versión, listo para volver a abrirlo en el asistente.
 *
 * Retomar una versión vieja es cómo se deshace una corrección: se abre la que
 * estaba bien, se ajusta lo que haga falta y al guardar sale una versión nueva.
 * El historial no se toca — no se "vuelve" a la versión 2, se hace una 5 que se
 * parece a la 2— porque las que ya se entregaron no se borran.
 *
 * Las urls se resuelven acá y no se guardan en el snapshot: una foto se puede
 * recortar o mover, y la url de hace tres meses puede no existir más. Los ids
 * sí son estables. Una foto cuyo archivo ya no está simplemente no vuelve, y el
 * resultado dice cuántas faltaron para que nadie lo descubra mirando el PDF.
 */
export async function contenidoDeVersionParaEditar(
  viewer: Viewer,
  informeId: string,
  version: number
) {
  ensureInformes(viewer);

  const fila = await prisma.informeVersion.findFirst({
    where: { informeId, version },
    select: { version: true, titulo: true, fecha: true, contenido: true },
  });
  if (!fila) throw new NotFoundError("Versión no encontrada");

  const c = fila.contenido as {
    visitaIds?: unknown;
    firmantes?: unknown;
    secciones?: unknown;
    encabezado?: unknown;
  } | null;
  // Las versiones anteriores a que se guardara el contenido quedaron con un
  // objeto vacío: de esas solo se puede mirar el PDF.
  if (!c || !Array.isArray(c.secciones)) return null;

  const secciones = c.secciones as Array<{
    productoId?: string | null;
    titulo?: string;
    descripcion?: string | null;
    saltoDePagina?: boolean;
    fotosPorFila?: number;
    fotos?: Array<{ visitaMediaId?: string | null; mediaId?: string | null }>;
  }>;

  const todas = secciones.flatMap((sec) => sec.fotos ?? []);
  const [visitaMedia, media] = await Promise.all([
    prisma.visitaMedia.findMany({
      where: {
        id: {
          in: todas
            .map((f) => f.visitaMediaId)
            .filter((x): x is string => Boolean(x)),
        },
      },
      select: { id: true, url: true },
    }),
    prisma.media.findMany({
      where: {
        id: {
          in: todas.map((f) => f.mediaId).filter((x): x is string => Boolean(x)),
        },
      },
      select: { id: true, key: true },
    }),
  ]);
  const urlDeVisita = new Map(visitaMedia.map((m) => [m.id, m.url]));
  const urlDeMedia = new Map(
    media.map((m) => [m.id, publicUrlForKey(m.key)] as const)
  );

  let perdidas = 0;
  const resueltas = secciones.map((sec) => ({
    productoId: sec.productoId ?? null,
    titulo: sec.titulo ?? "",
    descripcion: sec.descripcion ?? "",
    saltoDePagina: sec.saltoDePagina ?? false,
    fotosPorFila: (sec.fotosPorFila === 2 || sec.fotosPorFila === 4
      ? sec.fotosPorFila
      : 3) as 2 | 3 | 4,
    fotos: (sec.fotos ?? [])
      .map((f): FotoDeVersion | null => {
        const url = f.visitaMediaId
          ? urlDeVisita.get(f.visitaMediaId)
          : f.mediaId
            ? urlDeMedia.get(f.mediaId)
            : undefined;
        if (!url) {
          perdidas++;
          return null;
        }
        return {
          visitaMediaId: f.visitaMediaId ?? null,
          mediaId: f.mediaId ?? null,
          url,
        };
      })
      .filter((f): f is FotoDeVersion => f !== null),
  }));

  return {
    version: fila.version,
    titulo: fila.titulo,
    /** El encabezado con el que se imprimió esa versión, si lo guardó. */
    encabezado: typeof c.encabezado === "string" ? c.encabezado : null,
    fecha: fila.fecha,
    visitaIds: Array.isArray(c.visitaIds) ? (c.visitaIds as string[]) : [],
    firmantes: Array.isArray(c.firmantes)
      ? (c.firmantes as Array<{ nombre: string; cedula: string | null }>)
      : [],
    secciones: resueltas,
    /** Fotos que ya no existen y no se pudieron traer. */
    perdidas,
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
    const range: { gte?: Date; lt?: Date } = {};
    if (options.from) range.gte = options.from;
    if (options.to) {
      // El día entero, no hasta su medianoche. `fechaProgramada` es un
      // `DateTime`, así que con `lte` a las 00:00 quedaban afuera todas las
      // visitas de ese mismo día — un rango de un solo día no traía ninguna.
      const siguiente = new Date(options.to);
      siguiente.setUTCDate(siguiente.getUTCDate() + 1);
      range.lt = siguiente;
    }
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
  /**
   * Cómo se llama el informe en las listas y en el buscador.
   *
   * Lo manda la pantalla, pero si viene `encabezado` la primera línea de ese
   * manda: es lo que la persona escribió, y dos nombres para lo mismo terminan
   * en una lista que no dice lo que el PDF dice.
   */
  titulo: string;
  /**
   * El encabezado impreso, en HTML (ver `encabezado.ts`). Ausente = el de
   * siempre: el título en una línea y "ACTIVIDADES REALIZADAS PARA X" abajo.
   */
  encabezado?: string | null;
  /**
   * La que sale impresa, `YYYY-MM-DD`. Sin esto, el día de hoy.
   *
   * Un informe de agosto puede armarse el 2 de septiembre y tiene que decir
   * agosto; y regenerarlo para corregir una foto no le cambia la fecha al
   * documento que el cliente ya tiene.
   */
  fecha?: string;
  visitaIds: string[];
  /**
   * El número, cuando el informe sale de un borrador que ya tenía uno.
   *
   * Se hereda en vez de pedir otro: el borrador #17 se convierte en el informe
   * #17, o quien lo venía nombrando así tendría que aprender un número nuevo
   * justo al final. Sin esto, lo pone la secuencia.
   */
  numero?: number;
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
  const firmantesNormalizados = normalizarFirmantes(payload.firmantes);

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
  // El encabezado escrito, o el de siempre para los informes que se hicieron
  // antes de que fuera un campo: así regenerar uno viejo no le cambia la cara.
  const encabezadoHtml =
    sanitizarEncabezado(payload.encabezado) ??
    encabezadoPorDefecto(payload.titulo, cliente ? nombreCliente(cliente) : null);
  const encabezado = parsearEncabezado(encabezadoHtml);

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

  const fechaImpresa = fechaImpresaDe(payload);

  const renderData: InformeRenderData = {
    fecha: fechaImpresa,
    encabezado,
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
    encabezadoHtml,
    // El nombre en las listas sale del encabezado, no de un campo aparte: son
    // la misma cosa dicha una vez.
    tituloFinal: tituloDelEncabezado(encabezadoHtml) ?? payload.titulo,
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

/**
 * La fecha que sale impresa.
 *
 * Mediodía UTC y no medianoche: en Ecuador (UTC-5) medianoche cae el día
 * anterior y el PDF saldría con la fecha corrida.
 */
function normalizarFirmantes(
  firmantes: InformeFirmanteInput[] | undefined
): Array<{ nombre: string; cedula: string | null }> {
  return (firmantes ?? [])
    .map((f) => ({
      nombre: f.nombre.trim(),
      cedula: (f.cedula ?? "").trim() || null,
    }))
    .filter((f) => f.nombre.length > 0)
    .slice(0, 3);
}

/**
 * Las fechas que abarca el informe, según sus visitas.
 *
 * Aparte del armado completo porque el camino en que solo cambian las visitas
 * necesita esto y nada más: bajar las fotos y rearmar el PDF para corregir un
 * vínculo que no se imprime son tres segundos tirados.
 */
async function rangoDeVisitas(
  viewer: Viewer,
  payload: InformeGeneratePayload
): Promise<{ fechaDesde?: Date; fechaHasta?: Date }> {
  const visitas = await Promise.all(
    payload.visitaIds.map((id) => getVisitaForViewer(id, viewer))
  );
  for (const v of visitas) {
    if (v.cliente.id !== payload.clienteId) {
      throw new ValidationError("Una de las visitas no pertenece al cliente.");
    }
  }
  const fechas = visitas
    .map((v) => (v as unknown as { fechaProgramada: Date }).fechaProgramada)
    .sort((a, b) => a.getTime() - b.getTime());
  return { fechaDesde: fechas[0], fechaHasta: fechas[fechas.length - 1] };
}

function fechaImpresaDe(payload: InformeGeneratePayload): Date {
  return payload.fecha
    ? new Date(`${payload.fecha}T12:00:00.000Z`)
    : hoyEnEcuador();
}

/**
 * Si lo que se está por guardar cambia **lo que sale impreso**.
 *
 * Es lo que decide si nace una versión. Una versión existe porque hay otro PDF
 * entregable; si el documento sale igual, agregar una fila diría que se corrigió
 * algo y no se corrigió nada.
 *
 * Las **visitas quedan afuera a propósito**: no se imprimen —el renderizador ni
 * las mira— son el vínculo con el trabajo que el informe cuenta, y corregir ese
 * vínculo no cambia el papel. El cliente tampoco entra: no se puede cambiar.
 *
 * Compara contra la versión vigente y no contra las columnas del informe porque
 * es la versión la que sabe con qué se armó el PDF que hay.
 */
function cambiaElPdf(
  payload: InformeGeneratePayload,
  firmantes: Array<{ nombre: string; cedula: string | null }>,
  vigente: {
    titulo: string;
    fecha: Date;
    contenido: unknown;
  } | null,
  /**
   * El encabezado de antes y el de ahora, ya resueltos: el guardado, o el que
   * se generaba solo cuando el informe es anterior al campo. Se comparan
   * resueltos y no crudos, o reabrir un informe viejo y guardarlo sin tocar
   * nada crearía una versión idéntica a la anterior.
   */
  encabezados: { antes: string; ahora: string }
): boolean {
  // Sin versión vigente —o con una de las viejas, rellenadas sin contenido— no
  // hay con qué comparar, así que se asume que sí. Errar hacia crear una
  // versión de más es preferible: la de menos perdería el PDF anterior.
  if (!vigente) return true;
  const c = vigente.contenido as
    | { firmantes?: unknown; secciones?: unknown }
    | null;
  if (!c || typeof c !== "object" || !c.secciones) return true;

  if (encabezados.antes !== encabezados.ahora) return true;
  // Por día y no por instante: la columna es `@db.Date`, así que vuelve a
  // medianoche UTC y nunca iba a coincidir con el mediodía con que se guarda —
  // lo que hacía que "guardar sin tocar nada" creara una versión igual.
  const dia = (d: Date) => d.toISOString().slice(0, 10);
  if (dia(fechaImpresaDe(payload)) !== dia(vigente.fecha)) return true;
  return (
    !mismoJson(firmantes, c.firmantes) ||
    !mismoJson(payload.secciones, c.secciones)
  );
}

/**
 * Si dos valores JSON dicen lo mismo, sin importar el orden de las claves.
 *
 * **`jsonb` de Postgres reordena las claves** al guardar: `{titulo, fotos}`
 * vuelve como `{fotos, titulo}`. Comparar el texto de `JSON.stringify` daba
 * siempre distinto, así que cada guardado creaba una versión aunque no se
 * hubiera tocado nada. Se ordenan las claves de los dos lados antes de comparar.
 *
 * El orden de los **arreglos** sí importa y se respeta: mover una sección de
 * lugar cambia el PDF.
 */
function mismoJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));
}

function canonico(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, valor]) => valor !== undefined)
        .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
        .map(([clave, valor]) => [clave, canonico(valor)])
    );
  }
  return v;
}

/** Las secciones tal como se guardan, iguales al crear y al editar. */
function seccionesParaGuardar(
  secciones: Array<{
    productoId?: string | null;
    titulo: string;
    descripcion?: string | null;
    saltoDePagina?: boolean;
    fotosPorFila?: FotosPorFila;
    fotos: FotoResuelta[];
  }>
) {
  return secciones.map((sec, idx) => ({
    productoId: sec.productoId ?? null,
    titulo: sec.titulo,
    descripcion: sec.descripcion?.trim() || null,
    orden: idx * 10,
    // Se guarda aunque el PDF ya esté hecho: es lo que explica por qué salió
    // así, y lo que hay que releer para volver a abrirlo y editarlo.
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
  }));
}

/**
 * Con qué se armó una versión, congelado.
 *
 * Se guarda el pedido tal como llegó, no lo resuelto: los ids de las fotos son
 * estables y las urls no —una foto puede recortarse o moverse— así que el
 * pedido es lo que se puede volver a ejecutar dentro de un año.
 */
function contenidoDeVersion(
  payload: InformeGeneratePayload,
  firmantes: Array<{ nombre: string; cedula: string | null }>,
  /** Ya saneado: es lo que se imprimió, no lo que llegó del navegador. */
  encabezado: string
) {
  return {
    visitaIds: payload.visitaIds,
    firmantes,
    secciones: payload.secciones,
    encabezado,
  } as unknown as Prisma.InputJsonValue;
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
    encabezadoHtml,
    tituloFinal,
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
        titulo: tituloFinal,
        encabezado: encabezadoHtml,
        // Si viene de un borrador, su número; si no, el que siga la secuencia.
        ...(payload.numero ? { numero: payload.numero } : {}),
        fecha: fechaImpresa,
        fechaDesde,
        fechaHasta,
        pdfKey,
        pdfUrl,
        firmantes: firmantesNormalizados,
        generatedById: viewer.id,
        generatedByNombre: viewer.nombre ?? null,
        visitas: {
          create: payload.visitaIds.map((vid) => ({ visitaId: vid })),
        },
        secciones: { create: seccionesParaGuardar(seccionesResueltas) },
        // La versión 1 nace con el informe, en la misma transacción: un informe
        // sin ninguna versión sería uno cuyo PDF entregado no está en la lista.
        versiones: {
          create: {
            version: 1,
            titulo: tituloFinal,
            fecha: fechaImpresa,
            pdfKey,
            pdfUrl,
            contenido: contenidoDeVersion(
              payload,
              firmantesNormalizados,
              encabezadoHtml
            ),
            generatedById: viewer.id,
            generatedByNombre: viewer.nombre ?? null,
          },
        },
      },
    });
    return created;
  });

  return { id: result.id, pdfUrl };
}

/**
 * Vuelve a generar un informe que ya existe, dejando la versión anterior.
 *
 * **Editar no pisa lo entregado.** El PDF viejo queda como `InformeVersion`,
 * con su fecha y su autor, así que el que el cliente tiene en la mano se sigue
 * pudiendo abrir. Esa era la razón por la que antes no se editaba —quedaba un
 * documento circulando que ya no coincidía con el nuestro— y guardar las
 * versiones es lo que la desarma.
 *
 * Lo que **no** cambia es el `numero`: es el mismo informe, corregido, no uno
 * nuevo. Y `fechaDesde`/`fechaHasta` se recalculan porque dependen de las
 * visitas, que se pueden haber cambiado.
 *
 * Las secciones se reemplazan enteras en vez de conciliarlas fila por fila: el
 * asistente manda la lista completa y no hay nada colgando de una sección —las
 * fotos son suyas y se van con ella— así que emparejar solo agregaría formas de
 * equivocarse.
 */
export async function editarInforme(
  viewer: Viewer,
  id: string,
  payload: InformeGeneratePayload,
  nota?: string | null
) {
  ensureInformes(viewer);

  const actual = await prisma.informe.findUnique({
    where: { id },
    select: {
      id: true,
      clienteId: true,
      versionActual: true,
      pdfUrl: true,
      encabezado: true,
      visitas: { select: { visitaId: true } },
      // La vigente: con qué se armó el PDF que hay ahora.
      versiones: {
        orderBy: { version: "desc" },
        take: 1,
        select: { titulo: true, fecha: true, contenido: true },
      },
    },
  });
  if (!actual) throw new NotFoundError("Informe no encontrado");
  if (actual.clienteId !== payload.clienteId) {
    // Cambiarle el cliente sería otro informe: el número, las visitas y el
    // subtítulo impreso dejan de tener que ver con lo que dice la fila.
    throw new ValidationError("Un informe no cambia de cliente.");
  }

  const firmantesNormalizados = normalizarFirmantes(payload.firmantes);
  if (firmantesNormalizados.length === 0) {
    throw new ValidationError("Agrega al menos un firmante.");
  }

  // Para comparar encabezados hace falta el nombre del cliente: es lo que lleva
  // la línea que el PDF armaba solo en los informes anteriores al campo.
  const clienteDelInforme = await prisma.cliente.findUnique({
    where: { id: actual.clienteId },
    select: { nombre: true, apellido: true, empresa: true },
  });
  const nombreDelCliente = clienteDelInforme
    ? nombreCliente(clienteDelInforme)
    : null;
  const vigente = actual.versiones[0] ?? null;
  const hayQueRehacer = cambiaElPdf(
    payload,
    firmantesNormalizados,
    vigente,
    {
      antes:
        actual.encabezado ??
        encabezadoPorDefecto(vigente?.titulo ?? "", nombreDelCliente),
      ahora:
        sanitizarEncabezado(payload.encabezado) ??
        encabezadoPorDefecto(payload.titulo, nombreDelCliente),
    }
  );
  const cambianLasVisitas =
    JSON.stringify([...actual.visitas.map((v) => v.visitaId)].sort()) !==
    JSON.stringify([...payload.visitaIds].sort());

  // Nada cambió: no se escribe. Estampar "última edición" por haber apretado
  // guardar diría que alguien tocó el informe, y no lo tocó.
  if (!hayQueRehacer && !cambianLasVisitas) {
    return {
      id,
      pdfUrl: actual.pdfUrl,
      version: actual.versionActual,
      nuevaVersion: false,
      huboCambios: false,
    };
  }

  // Solo las visitas: se corrige el vínculo y listo. No sale otro PDF, así que
  // no hay versión que crear — una versión existe porque hay otro documento
  // entregable, y acá el papel es el mismo.
  if (!hayQueRehacer) {
    const { fechaDesde, fechaHasta } = await rangoDeVisitas(viewer, payload);
    await prisma.$transaction(async (tx) => {
      await tx.informeVisita.deleteMany({ where: { informeId: id } });
      await tx.informe.update({
        where: { id },
        data: {
          fechaDesde,
          fechaHasta,
          updatedById: viewer.id,
          updatedByNombre: viewer.nombre ?? null,
          visitas: {
            create: payload.visitaIds.map((vid) => ({ visitaId: vid })),
          },
        },
      });
    });
    return {
      id,
      pdfUrl: actual.pdfUrl,
      version: actual.versionActual,
      nuevaVersion: false,
      huboCambios: true,
    };
  }

  const {
    renderData,
    seccionesResueltas,
    fechaImpresa,
    fechaDesde,
    fechaHasta,
    encabezadoHtml,
    tituloFinal,
  } = await armarDatosDelInforme(viewer, payload, { borrador: false });

  const pdfBuffer = await renderInformePDF(renderData);
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
  const version = actual.versionActual + 1;

  await prisma.$transaction(async (tx) => {
    // Las secciones viejas se van con sus fotos (`Cascade`). Los archivos de
    // R2 no se tocan: son de la visita o de la biblioteca, y las viejas subidas
    // sueltas todavía las necesita la versión anterior para mostrarse.
    await tx.informeSeccion.deleteMany({ where: { informeId: id } });
    await tx.informeVisita.deleteMany({ where: { informeId: id } });

    await tx.informe.update({
      where: { id },
      data: {
        titulo: tituloFinal,
        encabezado: encabezadoHtml,
        fecha: fechaImpresa,
        fechaDesde,
        fechaHasta,
        pdfKey,
        pdfUrl,
        firmantes: firmantesNormalizados,
        versionActual: version,
        updatedById: viewer.id,
        updatedByNombre: viewer.nombre ?? null,
        visitas: {
          create: payload.visitaIds.map((vid) => ({ visitaId: vid })),
        },
        secciones: { create: seccionesParaGuardar(seccionesResueltas) },
        versiones: {
          create: {
            version,
            titulo: tituloFinal,
            fecha: fechaImpresa,
            pdfKey,
            pdfUrl,
            contenido: contenidoDeVersion(
              payload,
              firmantesNormalizados,
              encabezadoHtml
            ),
            generatedById: viewer.id,
            generatedByNombre: viewer.nombre ?? null,
            nota: nota?.trim() || null,
          },
        },
      },
    });
  });

  return { id, pdfUrl, version, nuevaVersion: true, huboCambios: true }
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
      updatedBy: {
        select: { id: true, name: true, apellido: true },
      },
      // De la más nueva a la más vieja: la que interesa es la última, y las
      // anteriores se miran cuando alguien busca "el que le mandé en agosto".
      versiones: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          titulo: true,
          fecha: true,
          pdfUrl: true,
          generatedAt: true,
          generatedByNombre: true,
          nota: true,
          contenido: true,
          generatedBy: { select: { id: true, name: true, apellido: true } },
        },
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
      // Todas las versiones, no solo la actual: cada edición dejó su propio
      // archivo, y borrar el informe sin ellos llenaría R2 de PDFs que ya no
      // tienen quién los nombre.
      versiones: { select: { pdfKey: true } },
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
    ...new Set([
      informe.pdfKey,
      ...informe.versiones.map((v) => v.pdfKey),
      ...informe.secciones.flatMap((s) => s.fotos.map((f) => f.key)),
    ]),
  ]);
}

