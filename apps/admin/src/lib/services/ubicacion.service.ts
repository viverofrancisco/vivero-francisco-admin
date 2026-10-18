import type { HorarioSemanal, Ubicacion, UbicacionDeRetiro } from "@vivero/shared";
import { Prisma } from "@/generated/prisma/client";
import { ubicacionSchema } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import type { z } from "zod";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors";

/**
 * Las ubicaciones del vivero (*Configuración → Ubicaciones*), las *Locations*
 * de Shopify: cada local con su dirección, su pin, su teléfono y su horario.
 * Hoy sirven para que el cliente **retire** su pedido de la app; el stock
 * sigue siendo uno solo para todo el vivero.
 *
 * Mirarlas es de la oficina; cambiarlas, del administrador, como el resto de
 * la configuración. Una ubicación que un pedido cita **no se borra**: se
 * desactiva, y el pedido sigue diciendo dónde se retiró.
 */

type Datos = z.output<typeof ubicacionSchema>;

const SELECT = {
  id: true,
  nombre: true,
  direccion: true,
  ciudad: true,
  referencia: true,
  lat: true,
  lng: true,
  telefono: true,
  horarios: true,
  retiro: true,
  activa: true,
  _count: { select: { pedidosDeRetiro: true } },
} as const;

type Fila = {
  id: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  horarios: Prisma.JsonValue;
  retiro: boolean;
  activa: boolean;
  _count: { pedidosDeRetiro: number };
};

function aUbicacion({ _count, horarios, ...u }: Fila): Ubicacion {
  return { ...u, horarios: (horarios as HorarioSemanal | null) ?? null, pedidos: _count.pedidosDeRetiro };
}

/** El horario como lo quiere Prisma: `null` de JSON es `JsonNull`, no SQL. */
function aColumnas<T extends { horarios?: HorarioSemanal | null }>(datos: T) {
  const { horarios, ...resto } = datos;
  return {
    ...resto,
    ...(horarios === undefined
      ? {}
      : { horarios: horarios === null ? Prisma.JsonNull : (horarios as unknown as Prisma.InputJsonValue) }),
  };
}

function ensureOficina(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError("Solo la oficina ve las ubicaciones.");
}

function ensureAdmin(viewer: Viewer) {
  if (viewer.role !== "ADMIN") {
    throw new ForbiddenError("Solo un administrador cambia las ubicaciones.");
  }
}

export async function listUbicaciones(
  viewer: Viewer,
  { estado }: { estado?: "activas" | "inactivas" } = {}
): Promise<Ubicacion[]> {
  ensureOficina(viewer);
  const filas = await prisma.ubicacion.findMany({
    where: estado ? { activa: estado === "activas" } : {},
    orderBy: [{ activa: "desc" }, { posicion: "asc" }, { nombre: "asc" }],
    select: SELECT,
  });
  return filas.map(aUbicacion);
}

export async function getUbicacion(viewer: Viewer, id: string): Promise<Ubicacion> {
  ensureOficina(viewer);
  const u = await prisma.ubicacion.findUnique({ where: { id }, select: SELECT });
  if (!u) throw new NotFoundError("Ubicación no encontrada");
  return aUbicacion(u);
}

export async function crearUbicacion(viewer: Viewer, datos: Datos): Promise<Ubicacion> {
  ensureAdmin(viewer);
  // Al final de la lista: la que se acaba de crear no salta delante de las demás.
  const ultima = await prisma.ubicacion.aggregate({ _max: { posicion: true } });
  const u = await prisma.ubicacion.create({
    data: { ...aColumnas(datos), posicion: (ultima._max.posicion ?? 0) + 10 },
    select: SELECT,
  });
  return aUbicacion(u);
}

export async function actualizarUbicacion(
  viewer: Viewer,
  id: string,
  datos: Partial<Datos>
): Promise<Ubicacion> {
  ensureAdmin(viewer);
  const ya = await prisma.ubicacion.findUnique({ where: { id }, select: { id: true } });
  if (!ya) throw new NotFoundError("Ubicación no encontrada");
  const u = await prisma.ubicacion.update({ where: { id }, data: aColumnas(datos), select: SELECT });
  return aUbicacion(u);
}

/** Borrar es para la cargada por error: con pedidos, se desactiva. */
export async function eliminarUbicacion(viewer: Viewer, id: string): Promise<void> {
  ensureAdmin(viewer);
  const u = await prisma.ubicacion.findUnique({
    where: { id },
    select: { nombre: true, _count: { select: { pedidosDeRetiro: true } } },
  });
  if (!u) throw new NotFoundError("Ubicación no encontrada");
  const n = u._count.pedidosDeRetiro;
  if (n > 0) {
    throw new ConflictError(
      `${u.nombre} tiene ${n === 1 ? "1 pedido" : `${n} pedidos`} para retirar ahí. Desactívala en vez de eliminarla.`
    );
  }
  await prisma.ubicacion.delete({ where: { id } });
}

/** Dónde puede retirar un cliente: las activas con el retiro prendido. */
export async function ubicacionesDeRetiro(): Promise<UbicacionDeRetiro[]> {
  const filas = await prisma.ubicacion.findMany({
    where: { activa: true, retiro: true },
    orderBy: [{ posicion: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      direccion: true,
      ciudad: true,
      referencia: true,
      lat: true,
      lng: true,
      telefono: true,
      horarios: true,
    },
  });
  return filas.map((u) => ({ ...u, horarios: (u.horarios as HorarioSemanal | null) ?? null }));
}
