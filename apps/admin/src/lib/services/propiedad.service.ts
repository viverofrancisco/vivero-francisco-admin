import { prisma } from "@/lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { PROPIEDAD_SELECT, type DatosDePropiedad } from "./cliente.service";

/**
 * Las propiedades de un cliente: los lugares donde se trabaja.
 *
 * La dirección era del cliente y se mudó acá, con el sector y los metros: un
 * cliente con dos casas tiene dos direcciones y ninguna es "la suya", y el
 * sector es geográfico —del lugar, no de la persona—.
 *
 * Escribir es de oficina, igual que el resto del cliente. El jardinero las ve
 * a través de su visita, que ya trae la suya.
 */
function ensureOficina(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

/** Los campos tal como se guardan, con los vacíos en `null`. */
function aColumnas(datos: DatosDePropiedad) {
  return {
    nombre: datos.nombre?.trim() || "Principal",
    ciudad: datos.ciudad || null,
    sectorId: datos.sectorId || null,
    direccion: datos.direccion || null,
    numeroCasa: datos.numeroCasa || null,
    referencia: datos.referencia || null,
    notas: datos.notas || null,
    lat: datos.lat ?? null,
    lng: datos.lng ?? null,
    m2Total: datos.m2Total ?? null,
    jardinerasPlantaAlta: datos.jardinerasPlantaAlta ?? false,
    numeroArboles: datos.numeroArboles ?? null,
    mlVegetacionBaja: datos.mlVegetacionBaja ?? null,
    mlVegetacionMedia: datos.mlVegetacionMedia ?? null,
    mlVegetacionAlta: datos.mlVegetacionAlta ?? null,
    m2Cesped: datos.m2Cesped ?? null,
  };
}

export async function crearPropiedad(
  viewer: Viewer,
  clienteId: string,
  datos: DatosDePropiedad
) {
  ensureOficina(viewer);

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, deletedAt: null },
    select: { id: true },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");

  return prisma.propiedad.create({
    data: {
      ...aColumnas(datos),
      clienteId: cliente.id,
      createdById: viewer.id,
      updatedById: viewer.id,
    },
    select: PROPIEDAD_SELECT,
  });
}

export async function actualizarPropiedad(
  viewer: Viewer,
  clienteId: string,
  propiedadId: string,
  datos: DatosDePropiedad
) {
  ensureOficina(viewer);

  // Acotado al cliente: un id de otro no se toca aunque exista.
  const propiedad = await prisma.propiedad.findFirst({
    where: { id: propiedadId, clienteId, deletedAt: null },
    select: { id: true },
  });
  if (!propiedad) throw new NotFoundError("Propiedad no encontrada");

  return prisma.propiedad.update({
    where: { id: propiedad.id },
    data: { ...aColumnas(datos), updatedById: viewer.id },
    select: PROPIEDAD_SELECT,
  });
}

/**
 * Archivar una propiedad.
 *
 * **Con visitas no se borra.** Esas visitas pasaron ahí: sacarle el lugar a una
 * visita hecha deja un registro que no se puede explicar, igual que borrar una
 * visita que una orden dice cubrir. Si ya no se trabaja en ella, deja de
 * agendarse y listo.
 *
 * Es soft delete: la propiedad sigue existiendo para lo que ya la nombra, y lo
 * que desaparece es de las listas y del selector al agendar.
 */
export async function eliminarPropiedad(
  viewer: Viewer,
  clienteId: string,
  propiedadId: string
) {
  ensureOficina(viewer);

  const propiedad = await prisma.propiedad.findFirst({
    where: { id: propiedadId, clienteId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      _count: {
        select: {
          visitas: true,
          // Un plan vivo es de un jardín: sin el jardín no dice qué cubre. Uno
          // cancelado no cuenta —ya no renueva— y se queda como historia.
          suscripciones: { where: { estado: { not: "CANCELADO" } } },
        },
      },
    },
  });
  if (!propiedad) throw new NotFoundError("Propiedad no encontrada");

  if (propiedad._count.visitas > 0) {
    throw new ConflictError(
      `${propiedad.nombre} tiene ${propiedad._count.visitas} visita${
        propiedad._count.visitas === 1 ? "" : "s"
      }, así que no se puede eliminar.`
    );
  }
  if (propiedad._count.suscripciones > 0) {
    throw new ConflictError(
      `${propiedad.nombre} tiene una suscripción vigente. Cancélala o pásala a otra propiedad antes de eliminarla.`
    );
  }

  await prisma.propiedad.update({
    where: { id: propiedad.id },
    data: { deletedAt: new Date(), updatedById: viewer.id },
  });
}
