import { prisma } from "@/lib/prisma";
import {
  nombreCliente,
  type CrearSolicitudBody,
  type SolicitudDeInvitadoBody,
  type SolicitudItem,
} from "@vivero/shared";
import type { Prisma } from "@/generated/prisma/client";
import { pushSolicitudDeCliente } from "@/lib/push/triggers";
import { ForbiddenError, NotFoundError } from "./errors";
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
  contactoNombre: true,
  contactoTelefono: true,
  contactoEmail: true,
  createdAt: true,
  atendidaEl: true,
  atendidaPorNombre: true,
  producto: { select: { id: true, nombre: true } },
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

function aItem(s: Prisma.SolicitudClienteGetPayload<{ select: typeof SELECT }>): SolicitudItem {
  const { contactoNombre, contactoTelefono, contactoEmail, ...resto } = s;
  return {
    ...resto,
    contacto: s.cliente
      ? {
          nombre: nombreCliente(s.cliente),
          telefono: s.cliente.telefono,
          email: s.cliente.email,
        }
      : {
          nombre: contactoNombre ?? "Sin nombre",
          telefono: contactoTelefono,
          email: contactoEmail,
        },
    createdAt: s.createdAt.toISOString(),
    atendidaEl: s.atendidaEl?.toISOString() ?? null,
  };
}

async function ensureProductoVivo(productoId: string | undefined) {
  if (!productoId) return;
  const existe = await prisma.producto.findFirst({
    where: { id: productoId, deletedAt: null },
    select: { id: true },
  });
  if (!existe) throw new NotFoundError("Ese producto ya no está disponible");
}

async function avisar(id: string) {
  // Que un aviso que no sale no le diga a quien pidió que su pedido falló:
  // quedó guardado, y la lista lo muestra igual.
  await pushSolicitudDeCliente(id).catch((e) =>
    console.error("[solicitud] no se pudo avisar", e)
  );
}

/**
 * Desde el modo invitado: alguien que todavía no tiene cuenta. No crea un
 * cliente —un pedido no es un cliente, y una ficha por cada curioso llenaría
 * la lista—; guarda con quién hablar, y si se cierra el trato lo carga el
 * vivero.
 */
export async function crearSolicitudDeInvitado(
  datos: SolicitudDeInvitadoBody
): Promise<SolicitudItem> {
  await ensureProductoVivo(datos.productoId);
  const creada = await prisma.solicitudCliente.create({
    data: {
      productoId: datos.productoId ?? null,
      mensaje: datos.mensaje.trim(),
      direccion: datos.direccion?.trim() || null,
      contactoNombre: datos.nombre.trim(),
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
  datos: CrearSolicitudBody
): Promise<SolicitudItem> {
  if (viewer.role !== "CLIENTE" || !viewer.clienteId) {
    throw new ForbiddenError("Las solicitudes las hacen los clientes");
  }
  await ensureProductoVivo(datos.productoId);

  const creada = await prisma.solicitudCliente.create({
    data: {
      clienteId: viewer.clienteId,
      productoId: datos.productoId ?? null,
      mensaje: datos.mensaje.trim(),
      direccion: datos.direccion?.trim() || null,
    },
    select: SELECT,
  });

  await avisar(creada.id);
  return aItem(creada);
}

export type FiltroSolicitudes = "pendientes" | "atendidas" | "todas";

export async function listarSolicitudes(
  viewer: Viewer,
  opciones: { estado?: FiltroSolicitudes; offset?: number; limit?: number } = {}
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

/** Marcarla atendida, o devolverla a pendiente si se marcó por error. */
export async function marcarSolicitudAtendida(
  viewer: Viewer,
  id: string,
  atendida: boolean
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
