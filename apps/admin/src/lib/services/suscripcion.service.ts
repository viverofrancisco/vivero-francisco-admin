/**
 * Suscripciones: lo recurrente que un cliente tiene contratado.
 *
 * **Un plan es un precio por un jardín.** Dice de qué propiedad del cliente
 * es, cuánto se cobra por período (sin IVA, con su tasa aparte) y cuántas
 * visitas incluye. No lleva productos: era una lista de ítems del catálogo,
 * cada uno con su precio, y armar un plan era elegir tres productos y ponerles
 * precio a cada uno para llegar a la mensualidad que ya se había pactado. Lo
 * que se acuerda con el cliente es un número por mantenerle ese jardín.
 *
 * Cada renovación genera una orden con **una línea**, la del período, y esa
 * orden se emite como una factura. Los trabajos sueltos no pasan por acá: se
 * arman a mano en una orden con productos del catálogo.
 */
import { Prisma } from "@/generated/prisma/client";
import type { EstadoServicio, Periodicidad } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { clavePeriodo } from "@/lib/periodos";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { FACTURA_VIGENTE } from "./factura-vigente";

function ensureCanWrite(viewer: Viewer): void {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
}

/** `true` si el error de Prisma es una FK con `onDelete: Restrict`. */
export function isForeignKeyRestriction(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

/** Lo que se pacta: el precio del período, su IVA y las visitas que incluye. */
export interface TerminosDelPlan {
  precio: number;
  ivaTasa?: number | null;
  visitasPorPeriodo: number;
}

/**
 * Las reglas del precio y las visitas, en un solo lugar: estaban repetidas
 * en cada formulario y en el servicio, y tres copias son tres versiones.
 */
function validarTerminos(t: Partial<TerminosDelPlan>): void {
  if (t.precio !== undefined && !(t.precio >= 0)) {
    throw new ValidationError("El precio no puede ser negativo.");
  }
  if (t.ivaTasa != null && (t.ivaTasa < 0 || t.ivaTasa > 100)) {
    throw new ValidationError("El IVA tiene que estar entre 0 y 100.");
  }
  if (
    t.visitasPorPeriodo !== undefined &&
    !(Number.isInteger(t.visitasPorPeriodo) && t.visitasPorPeriodo >= 1)
  ) {
    throw new ValidationError("Indica cuántas visitas incluye cada período.");
  }
}

/**
 * La propiedad del plan tiene que ser del cliente, y estar viva.
 *
 * El cliente manda el id y el servidor lo comprueba: si no, se le podría
 * armar a alguien un plan sobre la casa de otro.
 */
async function validarPropiedadDelCliente(
  propiedadId: string | null | undefined,
  clienteId: string
): Promise<string> {
  if (!propiedadId) {
    throw new ValidationError("Elige de qué propiedad es el plan.");
  }
  const propiedad = await prisma.propiedad.findFirst({
    where: { id: propiedadId, clienteId, deletedAt: null },
    select: { id: true },
  });
  if (!propiedad) {
    throw new ValidationError("Esa propiedad no es de este cliente.");
  }
  return propiedad.id;
}

export interface CrearSuscripcionPayload extends TerminosDelPlan {
  clienteId: string;
  propiedadId: string;
  periodicidad?: Periodicidad;
  fechaInicio?: Date | string;
  notas?: string | null;
}

/** Dónde queda el jardín del plan: lo que hace falta para escribirlo y llegar. */
export const UBICACION_DE_PROPIEDAD = {
  id: true,
  nombre: true,
  ciudad: true,
  direccion: true,
  numeroCasa: true,
  referencia: true,
  lat: true,
  lng: true,
  sector: { select: { id: true, nombre: true } },
} satisfies Prisma.PropiedadSelect;

/** Lo que toda lectura de un plan trae consigo: el cliente y el jardín. */
const SUSCRIPCION_INCLUDE = {
  cliente: {
    select: { id: true, nombre: true, apellido: true, empresa: true },
  },
  propiedad: { select: UBICACION_DE_PROPIEDAD },
} satisfies Prisma.SuscripcionInclude;

export async function crearSuscripcion(
  viewer: Viewer,
  payload: CrearSuscripcionPayload
) {
  ensureCanWrite(viewer);

  const cliente = await prisma.cliente.findFirst({
    where: { id: payload.clienteId, deletedAt: null },
    select: { id: true },
  });
  if (!cliente) throw new NotFoundError("Cliente no encontrado");

  validarTerminos(payload);
  const propiedadId = await validarPropiedadDelCliente(
    payload.propiedadId,
    cliente.id
  );

  return prisma.suscripcion.create({
    data: {
      clienteId: cliente.id,
      propiedadId,
      periodicidad: payload.periodicidad ?? "MENSUAL",
      fechaInicio: payload.fechaInicio
        ? new Date(payload.fechaInicio)
        : new Date(),
      precio: payload.precio,
      ivaTasa: payload.ivaTasa ?? 0,
      visitasPorPeriodo: payload.visitasPorPeriodo,
      notas: payload.notas?.trim() || null,
      createdById: viewer.id,
      updatedById: viewer.id,
    },
    include: SUSCRIPCION_INCLUDE,
  });
}

export interface ActualizarSuscripcionPayload extends Partial<TerminosDelPlan> {
  /** Otra propiedad **del mismo cliente**: se cargó contra la casa y era la oficina. */
  propiedadId?: string;
  periodicidad?: Periodicidad;
  estado?: EstadoServicio;
  fechaInicio?: Date | string;
  notas?: string | null;
}

/**
 * Editar un plan. Cada campo se aplica solo si vino.
 *
 * Cambiar el precio rige desde el próximo período: los ya facturados tienen
 * su `OrdenLinea.precioUnitario`, que es un snapshot. Cambiar la propiedad no
 * mueve ninguna visita: las que ya pasaron, pasaron donde pasaron.
 */
export async function actualizarSuscripcion(
  viewer: Viewer,
  suscripcionId: string,
  payload: ActualizarSuscripcionPayload
) {
  ensureCanWrite(viewer);

  const actual = await prisma.suscripcion.findUnique({
    where: { id: suscripcionId },
    select: { id: true, clienteId: true },
  });
  if (!actual) throw new NotFoundError("Suscripción no encontrada");

  validarTerminos(payload);
  const propiedadId =
    payload.propiedadId !== undefined
      ? await validarPropiedadDelCliente(payload.propiedadId, actual.clienteId)
      : undefined;

  return prisma.suscripcion.update({
    where: { id: suscripcionId },
    data: {
      ...(propiedadId ? { propiedadId } : {}),
      ...(payload.periodicidad ? { periodicidad: payload.periodicidad } : {}),
      ...(payload.estado ? { estado: payload.estado } : {}),
      ...(payload.fechaInicio
        ? { fechaInicio: new Date(payload.fechaInicio) }
        : {}),
      ...(payload.precio !== undefined ? { precio: payload.precio } : {}),
      ...(payload.ivaTasa !== undefined
        ? { ivaTasa: payload.ivaTasa ?? 0 }
        : {}),
      ...(payload.visitasPorPeriodo !== undefined
        ? { visitasPorPeriodo: payload.visitasPorPeriodo }
        : {}),
      ...(payload.notas !== undefined
        ? { notas: payload.notas?.trim() || null }
        : {}),
      updatedById: viewer.id,
    },
    include: SUSCRIPCION_INCLUDE,
  });
}

export async function cambiarEstadoSuscripcion(
  viewer: Viewer,
  suscripcionId: string,
  estado: EstadoServicio
) {
  ensureCanWrite(viewer);
  const existe = await prisma.suscripcion.count({ where: { id: suscripcionId } });
  if (!existe) throw new NotFoundError("Suscripción no encontrada");
  return prisma.suscripcion.update({
    where: { id: suscripcionId },
    data: {
      estado,
      ...(estado === "CANCELADO" ? { fechaFin: new Date() } : { fechaFin: null }),
      updatedById: viewer.id,
    },
  });
}

// ──────────────────────────────────────────────
// Consulta
// ──────────────────────────────────────────────

export interface ListarSuscripcionesOptions {
  clienteId?: string;
  estado?: EstadoServicio;
  incluirCanceladas?: boolean;
}

export async function listarSuscripciones(
  viewer: Viewer,
  options: ListarSuscripcionesOptions = {}
) {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }

  const where: Prisma.SuscripcionWhereInput = { cliente: { deletedAt: null } };
  if (options.clienteId) where.clienteId = options.clienteId;
  if (options.estado) where.estado = options.estado;
  else if (!options.incluirCanceladas) where.estado = { not: "CANCELADO" };

  return prisma.suscripcion.findMany({
    where,
    include: SUSCRIPCION_INCLUDE,
    orderBy: [{ estado: "asc" }, { cliente: { nombre: "asc" } }],
  });
}

/**
 * Las órdenes que salieron de los períodos de esta suscripción.
 *
 * Por la cabecera —`Orden.suscripcionId`, que la migración completó también
 * en las que el cron creaba sin ella— y no por las líneas: una orden anulada
 * suelta el vínculo de sus líneas, para que el período se pueda volver a
 * cobrar, y aun así sigue siendo una orden de este plan que conviene ver. Se
 * listan **órdenes y no facturas** porque el borrador que crea el cron todavía
 * no tiene factura, y era justo lo que no se veía desde acá.
 */
export async function ordenesDeSuscripcion(viewer: Viewer, suscripcionId: string) {
  await getSuscripcion(viewer, suscripcionId);

  const ordenes = await prisma.orden.findMany({
    where: { suscripcionId },
    select: {
      id: true,
      numero: true,
      fecha: true,
      estado: true,
      total: true,
      // Las líneas del plan: las que tienen período. Una orden vieja puede
      // traer varias del mismo período —una por cada producto que el plan
      // tenía entonces—, así que los períodos se cuentan por fecha, no por
      // línea.
      lineas: {
        where: { periodoInicio: { not: null } },
        select: { periodoInicio: true, periodoFin: true, total: true },
        orderBy: { periodoInicio: "asc" },
      },
      facturas: {
        where: FACTURA_VIGENTE,
        select: { numero: true, estado: true, saldo: true },
        take: 1,
      },
    },
    orderBy: { fecha: "desc" },
  });

  return ordenes.map((o) => ({
    id: o.id,
    numero: o.numero,
    fecha: o.fecha,
    estado: o.estado,
    total: Number(o.total),
    // Lo que aportó **este** plan, que puede ser menos que el total de la orden
    // si adentro hay además un producto agregado a mano.
    delPlan: o.lineas.reduce((a, l) => a + Number(l.total), 0),
    periodoInicio: o.lineas[0]?.periodoInicio ?? null,
    periodoFin: o.lineas[o.lineas.length - 1]?.periodoFin ?? null,
    periodos: new Set(o.lineas.map((l) => clavePeriodo(l.periodoInicio!))).size,
    factura: o.facturas[0]
      ? {
          numero: o.facturas[0].numero,
          estado: o.facturas[0].estado,
          saldo:
            o.facturas[0].saldo === null ? null : Number(o.facturas[0].saldo),
        }
      : null,
  }));
}

/**
 * Las visitas de este plan: una relación directa, `Visita.suscripcionId`.
 * La visita es del plan, o no lo es.
 */
export async function visitasDeSuscripcion(viewer: Viewer, suscripcionId: string) {
  // Valida que el viewer pueda ver el plan.
  await getSuscripcion(viewer, suscripcionId);

  return prisma.visita.findMany({
    where: { suscripcionId, deletedAt: null },
    select: {
      id: true,
      numero: true,
      fechaProgramada: true,
      fechaRealizada: true,
      estado: true,
      // Lo que se hizo, para que la fila diga algo más que una fecha.
      personal: {
        where: { removedAt: null },
        select: {
          personal: { select: { nombre: true, apellido: true } },
          tareas: {
            select: {
              tarea: { select: { id: true, nombre: true, orden: true } },
            },
          },
        },
      },
      tareasObligatorias: {
        select: { tarea: { select: { id: true, nombre: true, orden: true } } },
      },
    },
    orderBy: { fechaProgramada: "desc" },
  });
}

export async function getSuscripcion(viewer: Viewer, id: string) {
  if (!isAdminRole(viewer.role)) {
    throw new ForbiddenError();
  }
  const s = await prisma.suscripcion.findUnique({
    where: { id },
    include: SUSCRIPCION_INCLUDE,
  });
  if (!s) throw new NotFoundError("Suscripción no encontrada");
  return s;
}
