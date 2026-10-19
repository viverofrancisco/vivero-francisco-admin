import { prisma } from "@/lib/prisma";
import { textoPlano } from "@/lib/html-seguro";
import { publicUrlForKey } from "@/lib/s3";
import { guardarDireccionComoPropiedad } from "./propiedad-desde-direccion";
import {
  direccionEnUnaLinea,
  nombreCliente,
  type CrearSolicitudBody,
  type SolicitudDeInvitadoBody,
  type ServicioParaSolicitar,
  type SolicitudItem,
} from "@vivero/shared";
import type { Prisma } from "@/generated/prisma/client";
import { pushSolicitudDeCliente } from "@/lib/push/triggers";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { isAdminRole, type Viewer } from "./viewer";

/**
 * Lo que un cliente le pide al vivero desde la app.
 *
 * La escribe **solo el cliente**, sobre sí mismo, y la leen los
 * administradores. Cuando entra, les llega una notificación en el momento —una
 * cotización contestada el mismo día es la que se cierra—, y queda en la lista
 * hasta que alguien la marca atendida.
 */

const SELECT = {
  id: true,
  numero: true,
  mensaje: true,
  direccion: true,
  lat: true,
  lng: true,
  calle: true,
  numeroCasa: true,
  ciudad: true,
  referencia: true,
  propiedad: { select: { id: true, nombre: true } },
  contactoNombre: true,
  contactoApellido: true,
  contactoTelefono: true,
  contactoEmail: true,
  createdAt: true,
  atendidaEl: true,
  atendidaPorNombre: true,
  otroServicio: true,
  servicios: {
    select: { producto: { select: { id: true, nombre: true } } },
    orderBy: { producto: { nombre: "asc" } },
  },
  adjuntos: {
    select: { id: true, url: true, tipo: true, nombre: true },
    orderBy: { createdAt: "asc" },
  },
  // Las que se agendaron desde ella, para ir de una a la otra.
  visitas: {
    where: { deletedAt: null },
    select: { id: true, numero: true, fechaProgramada: true, estado: true },
    orderBy: { fechaProgramada: "asc" },
  },
  cliente: {
    select: {
      id: true,
      nombre: true,
      apellido: true,
      empresa: true,
      telefono: true,
      email: true,
    },
  },
} satisfies Prisma.SolicitudClienteSelect;

function aItem(
  s: Prisma.SolicitudClienteGetPayload<{ select: typeof SELECT }>,
): SolicitudItem {
  const {
    contactoNombre,
    contactoApellido,
    contactoTelefono,
    contactoEmail,
    servicios,
    calle,
    numeroCasa,
    ciudad,
    referencia,
    ...resto
  } = s;
  return {
    ...resto,
    servicios: servicios.map((x) => x.producto),
    // Por partes solo las nuevas; las de antes guardaban la línea entera.
    direccionPorPartes:
      calle || numeroCasa || ciudad || referencia
        ? { calle, numeroCasa, ciudad, referencia }
        : null,
    adjuntos: s.adjuntos.map((a) => ({
      ...a,
      tipo: a.tipo === "video" ? "video" : "imagen",
    })),
    contacto: s.cliente
      ? {
          nombre: nombreCliente(s.cliente),
          // El que dejó en esta solicitud —es al que pidió que lo llamen—, o
          // el de su ficha en las que se hicieron antes de pedirlo.
          telefono: contactoTelefono ?? s.cliente.telefono,
          email: s.cliente.email,
          porPartes: null,
        }
      : {
          nombre:
            [contactoNombre, contactoApellido].filter(Boolean).join(" ") || "Sin nombre",
          telefono: contactoTelefono,
          email: contactoEmail,
          porPartes: contactoApellido
            ? { nombre: contactoNombre ?? "", apellido: contactoApellido }
            : null,
        },
    visitas: s.visitas.map((v) => ({
      id: v.id,
      numero: v.numero,
      fechaProgramada: v.fechaProgramada.toISOString(),
      estado: v.estado,
    })),
    createdAt: s.createdAt.toISOString(),
    atendidaEl: s.atendidaEl?.toISOString() ?? null,
  };
}

/**
 * Los servicios que marcó, validados: **al menos uno**, y servicios del
 * catálogo, vivos y activos —el id de un bien o de uno archivado no se cuela
 * por la API—. Uno repetido cuenta una vez. Una app vieja manda `productoId`
 * y se suma.
 */
async function serviciosDeLaSolicitud(
  datos: CrearSolicitudBody,
): Promise<string[]> {
  const ids = [
    ...new Set([
      ...(datos.servicioIds ?? []),
      ...(datos.productoId ? [datos.productoId] : []),
    ]),
  ];
  if (ids.length === 0) {
    // *Otros* cuenta: lo que quiere no está en la lista y lo dice el mensaje.
    if (datos.otroServicio) return [];
    throw new ValidationError("Elige al menos un servicio.");
  }
  const vivos = await prisma.producto.findMany({
    where: {
      id: { in: ids },
      tipo: "SERVICIO",
      estado: "ACTIVO",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (vivos.length !== ids.length) {
    throw new NotFoundError("Uno de los servicios ya no está disponible");
  }
  return ids;
}

/** Dónde suben sus adjuntos: un prefijo por cliente. */
export function prefijoDeAdjuntos(clienteId: string): string {
  return `solicitudes/${clienteId}/`;
}

/**
 * Los adjuntos ya subidos, listos para guardar. Cada `key` tiene que estar
 * bajo el prefijo **de este cliente** —el que firmó `upload-urls`—: sin esto,
 * cualquiera podría colgar de su solicitud un archivo ajeno del bucket.
 */
function adjuntosDeLaSolicitud(clienteId: string, datos: CrearSolicitudBody) {
  const prefijo = prefijoDeAdjuntos(clienteId);
  return (datos.adjuntos ?? []).map((a) => {
    if (!a.key.startsWith(prefijo) || a.key.includes("..")) {
      throw new ValidationError("Uno de los archivos no es tuyo.");
    }
    return {
      key: a.key,
      url: publicUrlForKey(a.key),
      tipo: a.contentType.startsWith("video/") ? "video" : "imagen",
      contentType: a.contentType,
      nombre: a.nombre?.trim() || null,
    };
  });
}

/**
 * Los servicios que se pueden marcar al pedir una visita: los activos del
 * catálogo, por nombre. Sin sesión, porque el invitado también los ve.
 */
export async function serviciosParaSolicitar(): Promise<
  ServicioParaSolicitar[]
> {
  const filas = await prisma.producto.findMany({
    where: { tipo: "SERVICIO", estado: "ACTIVO", deletedAt: null },
    select: { id: true, nombre: true, descripcion: true },
    orderBy: { nombre: "asc" },
  });
  // La descripción es HTML del editor del portal; el cajón muestra una línea.
  return filas.map((f) => ({
    ...f,
    descripcion: f.descripcion ? textoPlano(f.descripcion) || null : null,
  }));
}

/**
 * Dónde es el trabajo. Con una propiedad, **suya** —con el id de otra se le
 * mandaría la visita a la casa de otro—, y se copian su dirección y su pin;
 * si no, lo que escribió y el punto que marcó.
 */
/** Otra dirección por partes, para poder volverla una propiedad después. */
function partesDeLaDireccion(d: {
  direccion?: string;
  numeroCasa?: string;
  ciudad?: string;
  referencia?: string;
}) {
  return {
    calle: d.direccion?.trim() || null,
    numeroCasa: d.numeroCasa?.trim() || null,
    ciudad: d.ciudad?.trim() || null,
    referencia: d.referencia?.trim() || null,
  };
}

async function lugarDeLaSolicitud(
  clienteId: string,
  datos: CrearSolicitudBody,
) {
  if (datos.propiedadId) {
    const p = await prisma.propiedad.findFirst({
      where: { id: datos.propiedadId, clienteId, deletedAt: null },
      select: {
        id: true,
        direccion: true,
        numeroCasa: true,
        ciudad: true,
        referencia: true,
        lat: true,
        lng: true,
      },
    });
    if (!p) throw new ValidationError("Esa propiedad no es tuya.");
    return {
      propiedadId: p.id,
      direccion: direccionEnUnaLinea(p),
      lat: p.lat,
      lng: p.lng,
    };
  }
  return {
    propiedadId: null,
    direccion: direccionEnUnaLinea(datos),
    ...partesDeLaDireccion(datos),
    lat: datos.lat ?? null,
    lng: datos.lng ?? null,
  };
}

async function avisar(id: string) {
  // Que un aviso que no sale no le diga a quien pidió que su pedido falló:
  // quedó guardado, y la lista lo muestra igual.
  await pushSolicitudDeCliente(id).catch((e) =>
    console.error("[solicitud] no se pudo avisar", e),
  );
}

/**
 * Desde el modo invitado: alguien que todavía no tiene cuenta. No crea un
 * cliente —un pedido no es un cliente, y una ficha por cada curioso llenaría
 * la lista—; guarda con quién hablar, y si se cierra el trato lo carga el
 * vivero.
 */
export async function crearSolicitudDeInvitado(
  datos: SolicitudDeInvitadoBody,
): Promise<SolicitudItem> {
  const servicioIds = await serviciosDeLaSolicitud(datos);
  const creada = await prisma.solicitudCliente.create({
    data: {
      servicios: { create: servicioIds.map((productoId) => ({ productoId })) },
      otroServicio: datos.otroServicio ?? false,
      mensaje: datos.mensaje.trim(),
      direccion: direccionEnUnaLinea(datos),
      ...partesDeLaDireccion(datos),
      lat: datos.lat ?? null,
      lng: datos.lng ?? null,
      contactoNombre: datos.nombre.trim(),
      contactoApellido: datos.apellido?.trim() || null,
      contactoTelefono: datos.telefono.trim(),
      contactoEmail: datos.email?.trim() || null,
    },
    select: SELECT,
  });
  await avisar(creada.id);
  return aItem(creada);
}

export async function crearSolicitud(
  viewer: Viewer,
  datos: CrearSolicitudBody,
): Promise<SolicitudItem> {
  if (viewer.role !== "CLIENTE" || !viewer.clienteId) {
    throw new ForbiddenError("Las solicitudes las hacen los clientes");
  }
  const servicioIds = await serviciosDeLaSolicitud(datos);
  const adjuntos = adjuntosDeLaSolicitud(viewer.clienteId, datos);
  const lugar = await lugarDeLaSolicitud(viewer.clienteId, datos);
  const telefono = datos.telefono?.trim() || null;
  const clienteId = viewer.clienteId;
  // Sin un teléfono no hay cómo coordinar: el correo no sirve para eso. Una
  // app vieja no lo manda, y ahí alcanza con el de su ficha.
  if (!telefono) {
    const ficha = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { telefono: true },
    });
    if (!ficha?.telefono) {
      throw new ValidationError("Déjanos un teléfono para coordinar contigo.");
    }
  }

  // El teléfono se guarda solo en la solicitud: es a dónde quiere que lo
  // llamen esta vez, y su ficha se cambia desde su cuenta, no desde acá.
  const creada = await prisma.$transaction(async (tx) => {
    // Otra dirección con *Guardar en mi cuenta*: nace la propiedad y la
    // solicitud queda en ella, como si la hubiera elegido de su lista.
    const propiedadGuardada =
      lugar.propiedadId === null &&
      datos.guardarDireccion &&
      datos.direccion?.trim()
        ? await guardarDireccionComoPropiedad(tx, clienteId, datos, viewer.id)
        : null;
    return tx.solicitudCliente.create({
      data: {
        clienteId,
        servicios: {
          create: servicioIds.map((productoId) => ({ productoId })),
        },
        otroServicio: datos.otroServicio ?? false,
        adjuntos: { create: adjuntos },
        mensaje: datos.mensaje.trim(),
        contactoTelefono: telefono,
        ...lugar,
        ...(propiedadGuardada ? { propiedadId: propiedadGuardada } : {}),
      },
      select: SELECT,
    });
  });

  await avisar(creada.id);
  return aItem(creada);
}

export type FiltroSolicitudes = "pendientes" | "atendidas" | "todas";

export async function listarSolicitudes(
  viewer: Viewer,
  opciones: {
    estado?: FiltroSolicitudes;
    offset?: number;
    limit?: number;
  } = {},
): Promise<{ items: SolicitudItem[]; total: number; pendientes: number }> {
  const limit = Math.min(Math.max(opciones.limit ?? 25, 1), 100);
  const offset = Math.max(0, opciones.offset ?? 0);

  let where: Prisma.SolicitudClienteWhereInput;
  if (viewer.role === "CLIENTE") {
    // El cliente ve las suyas, todas: es como sabe si ya lo atendieron.
    if (!viewer.clienteId) throw new ForbiddenError("Sin cliente");
    where = { clienteId: viewer.clienteId };
  } else if (isAdminRole(viewer.role)) {
    const estado = opciones.estado ?? "pendientes";
    where =
      estado === "pendientes"
        ? { atendidaEl: null }
        : estado === "atendidas"
          ? { atendidaEl: { not: null } }
          : {};
  } else {
    throw new ForbiddenError("No tienes acceso a las solicitudes");
  }

  const [items, total, pendientes] = await Promise.all([
    prisma.solicitudCliente.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: SELECT,
    }),
    prisma.solicitudCliente.count({ where }),
    viewer.role === "CLIENTE"
      ? Promise.resolve(0)
      : prisma.solicitudCliente.count({ where: { atendidaEl: null } }),
  ]);
  return { items: items.map(aItem), total, pendientes };
}

/**
 * Una sola, para su ficha. El cliente abre **solo las suyas** —con el id de
 * otra vería el mensaje y la dirección de otro—; el equipo, cualquiera.
 */
export async function obtenerSolicitud(
  viewer: Viewer,
  id: string,
): Promise<SolicitudItem> {
  let where: Prisma.SolicitudClienteWhereInput;
  if (viewer.role === "CLIENTE") {
    if (!viewer.clienteId) throw new ForbiddenError("Sin cliente");
    where = { id, clienteId: viewer.clienteId };
  } else if (isAdminRole(viewer.role)) {
    where = { id };
  } else {
    throw new ForbiddenError("No tienes acceso a las solicitudes");
  }
  const s = await prisma.solicitudCliente.findFirst({ where, select: SELECT });
  if (!s) throw new NotFoundError("Solicitud no encontrada");
  return aItem(s);
}

/** Marcarla atendida, o devolverla a pendiente si se marcó por error. */
export async function marcarSolicitudAtendida(
  viewer: Viewer,
  id: string,
  atendida: boolean,
): Promise<SolicitudItem> {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError("Solo un administrador o staff puede atenderla");
  }
  const existe = await prisma.solicitudCliente.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existe) throw new NotFoundError("Solicitud no encontrada");

  const actualizada = await prisma.solicitudCliente.update({
    where: { id },
    data: atendida
      ? {
          atendidaEl: new Date(),
          atendidaPorId: viewer.id,
          atendidaPorNombre: viewer.nombre,
        }
      : { atendidaEl: null, atendidaPorId: null, atendidaPorNombre: null },
    select: SELECT,
  });
  return aItem(actualizada);
}
