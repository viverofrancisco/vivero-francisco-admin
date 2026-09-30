import { prisma } from "@/lib/prisma";
import type { Viewer } from "./viewer";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import {
  crearEnlaceParaUsuario,
  restaurarAcceso,
  revocarAcceso,
} from "./acceso.service";
import { estadoDeAcceso, usuarioLibre, type EstadoAcceso } from "./personal-acceso.service";

/**
 * Las cuentas del equipo —ADMIN y STAFF—: la pantalla de Usuarios, en el
 * portal y en la app. El personal de campo no aparece acá: su cuenta vive en
 * su ficha. Todo esto es del ADMIN.
 *
 * Estaba escrito adentro de las rutas del portal; con la app pidiendo lo
 * mismo, se juntó acá para que las dos respondan con las mismas reglas.
 */

export interface UsuarioDelEquipo {
  id: string;
  name: string | null;
  apellido: string | null;
  email: string | null;
  usuario: string | null;
  role: string;
  createdAt: string;
  acceso: EstadoAcceso;
  /** Tiene un enlace vivo sin usar: se le generó y falta que lo abra. */
  enlacePendiente: boolean;
}

function ensureAdmin(viewer: Viewer) {
  if (viewer.role !== "ADMIN") {
    throw new ForbiddenError("Solo un administrador maneja los usuarios");
  }
}

const SELECT = {
  id: true,
  name: true,
  apellido: true,
  email: true,
  usuario: true,
  role: true,
  createdAt: true,
  password: true,
  accesoRevocadoEl: true,
  _count: {
    select: {
      setPasswordTokens: {
        where: { usedAt: null, anuladoEl: null, expiresAt: { gt: new Date() } },
      },
    },
  },
} as const;

type Fila = {
  id: string;
  name: string | null;
  apellido: string | null;
  email: string | null;
  usuario: string | null;
  role: string;
  createdAt: Date;
  password: string | null;
  accesoRevocadoEl: Date | null;
  _count: { setPasswordTokens: number };
};

/** El hash no sale de acá: se convierte en el estado de acceso. */
function aUsuario(u: Fila): UsuarioDelEquipo {
  return {
    id: u.id,
    name: u.name,
    apellido: u.apellido,
    email: u.email,
    usuario: u.usuario,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    acceso: estadoDeAcceso({
      tieneContrasena: u.password !== null,
      revocado: u.accesoRevocadoEl !== null,
    }),
    enlacePendiente: u._count.setPasswordTokens > 0,
  };
}

export async function listUsuariosDelEquipo(viewer: Viewer): Promise<UsuarioDelEquipo[]> {
  ensureAdmin(viewer);
  const filas = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    select: SELECT,
    orderBy: { createdAt: "desc" },
  });
  return filas.map(aUsuario);
}

export async function getUsuarioDelEquipo(viewer: Viewer, id: string): Promise<UsuarioDelEquipo> {
  ensureAdmin(viewer);
  const u = await prisma.user.findUnique({ where: { id }, select: SELECT });
  if (!u || (u.role !== "ADMIN" && u.role !== "STAFF")) {
    throw new NotFoundError("Usuario no encontrado");
  }
  return aUsuario(u);
}

async function ensureCorreoLibre(email: string, exceptoId?: string) {
  const otro = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (otro && otro.id !== exceptoId) {
    throw new ConflictError("Ya existe un usuario con ese correo");
  }
}

/**
 * Crea la cuenta **sin contraseña** y emite su enlace de invitación, que se
 * devuelve para copiarlo o compartirlo; mandarlo por correo es otro gesto
 * (`enviarEnlacePorCorreo`). También le genera un usuario, como al personal.
 */
export async function crearUsuarioDelEquipo(
  viewer: Viewer,
  datos: { name: string; apellido?: string | null; email: string }
) {
  ensureAdmin(viewer);
  await ensureCorreoLibre(datos.email);
  const creado = await prisma.$transaction(async (tx) =>
    tx.user.create({
      data: {
        name: datos.name,
        apellido: datos.apellido || null,
        email: datos.email,
        usuario: await usuarioLibre(tx, datos.name, datos.apellido || null),
        role: "STAFF",
      },
      select: SELECT,
    })
  );
  const enlace = await crearEnlaceParaUsuario(creado.id, "invitacion");
  return {
    usuario: aUsuario({ ...creado, _count: { setPasswordTokens: 1 } }),
    enlace: enlace.url,
    expiraEl: enlace.expiraEl.toISOString(),
    correoEnviado: false,
    correoIntentado: false,
  };
}

export async function actualizarUsuarioDelEquipo(
  viewer: Viewer,
  id: string,
  datos: { name?: string; apellido?: string | null; email?: string }
): Promise<UsuarioDelEquipo> {
  ensureAdmin(viewer);
  const existente = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existente) throw new NotFoundError("Usuario no encontrado");
  if (datos.name !== undefined && !datos.name.trim()) {
    throw new ValidationError("El nombre es obligatorio");
  }
  if (datos.email) await ensureCorreoLibre(datos.email, id);
  const u = await prisma.user.update({
    where: { id },
    data: {
      ...(datos.name !== undefined ? { name: datos.name } : {}),
      ...(datos.apellido !== undefined ? { apellido: datos.apellido || null } : {}),
      ...(datos.email !== undefined ? { email: datos.email } : {}),
    },
    select: SELECT,
  });
  return aUsuario(u);
}

/**
 * Corta o devuelve el acceso, sin borrar la cuenta: su nombre firma lo que
 * hizo. Uno mismo no: dejarse afuera no tiene arreglo desde adentro.
 */
export async function cambiarAccesoUsuario(viewer: Viewer, id: string, revocado: boolean) {
  ensureAdmin(viewer);
  if (id === viewer.id) {
    throw new ValidationError("No puedes revocar tu propio acceso");
  }
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!u) throw new NotFoundError("Usuario no encontrado");
  if (revocado) await revocarAcceso(id);
  else await restaurarAcceso(id);
  return getUsuarioDelEquipo(viewer, id);
}
