import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { User, UserRole } from "@/generated/prisma/client";

/**
 * El usuario de la sesión, o null.
 *
 * Además de leer la sesión **relee la fila**, porque la sesión es un JWT que
 * vive semanas: sin esto, revocarle el acceso a alguien no lo sacaría hasta
 * que su token venciera solo. Es una búsqueda por clave primaria y es el
 * único embudo por el que pasan páginas y rutas, así que el costo es una
 * consulta por request y la garantía es que revocar surte efecto ya.
 */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const vigente = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accesoRevocadoEl: true },
  });
  if (!vigente || vigente.accesoRevocadoEl) return null;
  return session.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}

/**
 * Solo el personal de oficina: ADMIN y STAFF.
 *
 * Es el corte de "esto es plata o es un documento que se le entrega al
 * cliente" —órdenes, facturas, informes—, y desde que se fue `PERSONAL_ADMIN`
 * es además el corte de quién agenda y quién cierra una visita. El `PERSONAL`
 * ve las visitas donde está asignado y registra lo que hizo en ellas; nada más.
 */
export async function requireStaff() {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    redirect("/dashboard");
  }
  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}

/**
 * Quién no puede escribir **desde el portal web**.
 *
 * El jardinero sí escribe, pero solo su parte de una visita, y eso va por su
 * propia ruta (`registrarParte`), que valida quién es. Todo lo demás del
 * dashboard —agendar, editar, cerrar— es de oficina.
 */
export function isReadOnly(role: UserRole): boolean {
  return role === "PERSONAL" || role === "CLIENTE";
}

export function isPersonalRole(role: UserRole): boolean {
  return role === "PERSONAL";
}

import type { Viewer } from "@/lib/services/viewer";

/**
 * Convert the current NextAuth session into the `Viewer` shape that
 * `lib/services/*` expects, so server components and admin API routes can
 * call the same service functions the mobile API uses.
 */
export async function viewerFromSession(): Promise<Viewer> {
  return viewerFromUser(await requireAuth());
}

/**
 * Igual que `viewerFromSession` pero sobre un usuario ya cargado, para las
 * rutas que llamaron a `getCurrentUser()` y no necesitan resolver la sesión
 * de nuevo.
 */
export function viewerFromUser(user: {
  id: string;
  role: UserRole;
  personalId?: string | null;
  name?: string | null;
  apellido?: string | null;
}): Viewer {
  return {
    id: user.id,
    role: user.role,
    personalId: user.personalId ?? null,
    clienteId: null, // web admin users are never CLIENTE
    nombre: [user.name, user.apellido].filter(Boolean).join(" ") || null,
  };
}

export async function validateCredentials(
  email: string,
  password: string
): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.password) return null;
  // Con el acceso revocado la contraseña deja de importar.
  if (user.accesoRevocadoEl) return null;
  const valid = await bcrypt.compare(password, user.password);
  return valid ? user : null;
}
