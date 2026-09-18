import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "./errors";
import type { Viewer } from "./viewer";
import { isAdminRole } from "./viewer";
import {
  cambiarUsuarioPersonal,
  crearCuentaPersonal,
} from "./personal-acceso.service";
import { revocarAcceso } from "./acceso.service";

/**
 * La gente del vivero: su ficha y su cuenta.
 *
 * Vivía suelto adentro de las rutas web, con `prisma` a mano y la
 * autorización reducida a "hay sesión". Se mudó acá cuando la app necesitó lo
 * mismo: dos implementaciones de "crear un jardinero" son dos reglas que se van
 * separando, y la de la ficha-con-cuenta es justamente la que no se puede
 * perder —una ficha sin cuenta es alguien que no puede abrir la app, y nadie se
 * entera hasta que hay que cargar un parte—.
 *
 * **Leer es de la oficina y del jardinero** —el segundo necesita la lista para
 * elegir a quién asignar cuando la oficina le pasa la agenda— pero **escribir
 * es solo de ADMIN/STAFF**. Antes escribía cualquiera con sesión, incluido un
 * `CLIENTE`.
 */
export interface DatosDePersonal {
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
  especialidad?: string | null;
  sueldo?: number | null;
  /** `"ACTIVO"` | `"INACTIVO"`: texto en la base, no un enum de Prisma. */
  estado?: string;
  /** `"JARDINERO"`, `"CHOFER"`, `"SUPERVISOR"`, `"MECANICO"`. */
  tipo?: string | null;
  /** Con qué entra a la app. Vive en `User`; solo un ADMIN lo cambia. */
  usuario?: string | null;
}

function ensureOficina(viewer: Viewer) {
  if (!isAdminRole(viewer.role)) throw new ForbiddenError();
}

function ensurePuedeVer(viewer: Viewer) {
  // El cliente no tiene nada que hacer en la lista de empleados del vivero.
  if (viewer.role === "CLIENTE") throw new ForbiddenError();
}

/** Los campos de la ficha, con los vacíos en `null`. */
function aColumnas(datos: DatosDePersonal) {
  return {
    nombre: datos.nombre,
    apellido: datos.apellido || null,
    telefono: datos.telefono || null,
    especialidad: datos.especialidad || null,
    sueldo: datos.sueldo ?? null,
    estado: datos.estado ?? "ACTIVO",
    tipo: datos.tipo || null,
  };
}

/** Lo que la ficha muestra, incluido el usuario con el que entra. */
const PERSONAL_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  telefono: true,
  especialidad: true,
  sueldo: true,
  estado: true,
  tipo: true,
  createdAt: true,
  user: { select: { id: true, usuario: true, accesoRevocadoEl: true } },
} as const;

export async function listPersonal(viewer: Viewer) {
  ensurePuedeVer(viewer);
  return prisma.personal.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: PERSONAL_SELECT,
  });
}

export async function getPersonal(viewer: Viewer, id: string) {
  ensurePuedeVer(viewer);
  const personal = await prisma.personal.findFirst({
    where: { id, deletedAt: null },
    select: PERSONAL_SELECT,
  });
  if (!personal) throw new NotFoundError("Personal no encontrado");
  return personal;
}

/**
 * La ficha y su cuenta, en la misma transacción.
 *
 * Crear la cuenta aparte era un paso que alguien se salteaba, y quedaba gente
 * cargada que no podía entrar a la app. Una cuenta sin contraseña no entra a
 * ningún lado, así que crearla siempre no abre nada: al que no deba entrar se
 * le revoca el acceso desde su ficha.
 */
export async function crearPersonal(viewer: Viewer, datos: DatosDePersonal) {
  ensureOficina(viewer);
  return prisma.$transaction(async (tx) => {
    const creado = await tx.personal.create({
      data: { ...aColumnas(datos), createdById: viewer.id, updatedById: viewer.id },
    });
    await crearCuentaPersonal(tx, creado);
    return tx.personal.findUniqueOrThrow({
      where: { id: creado.id },
      select: PERSONAL_SELECT,
    });
  });
}

export async function actualizarPersonal(
  viewer: Viewer,
  id: string,
  datos: DatosDePersonal
) {
  ensureOficina(viewer);

  const actual = await prisma.personal.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, user: { select: { usuario: true } } },
  });
  if (!actual) throw new NotFoundError("Personal no encontrado");

  await prisma.personal.update({
    where: { id },
    data: { ...aColumnas(datos), updatedById: viewer.id },
  });

  // El usuario va en la misma pantalla pero no en la misma tabla, y se aplica
  // solo si **cambió**: así guardar la ficha sin tocarlo no devuelve "ya está
  // tomado" contra su propia cuenta. Solo ADMIN, porque dar o quitar acceso es
  // suyo y el resto del formulario no lo es.
  const pedido = datos.usuario?.trim();
  if (pedido && pedido !== actual.user?.usuario) {
    if (viewer.role !== "ADMIN") {
      throw new ForbiddenError("Solo un administrador puede cambiar el usuario");
    }
    await cambiarUsuarioPersonal(id, pedido);
  }

  return getPersonal(viewer, id);
}

/**
 * Archivar a alguien **le corta el acceso**.
 *
 * Su ficha desaparece de las listas y la app no le muestra nada, pero su cuenta
 * seguía entrando. La cuenta no se borra: su nombre firma los partes que cargó,
 * y devolverle el acceso es un clic si vuelve.
 */
export async function archivarPersonal(viewer: Viewer, id: string) {
  ensureOficina(viewer);
  const personal = await prisma.personal.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!personal) throw new NotFoundError("Personal no encontrado");

  await prisma.personal.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: viewer.id },
  });
  if (personal.userId) await revocarAcceso(personal.userId);
}
