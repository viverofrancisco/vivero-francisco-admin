import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendSetPasswordEmail, type SendEmailResult } from "@/lib/email";
import { crearEnlaceParaCliente } from "./acceso.service";
import type { Cliente, User } from "@/generated/prisma/client";

// ──────────────────────────────────────────────
// Resolución de cliente por identificador (teléfono o correo)
// ──────────────────────────────────────────────

export type ResolveResult =
  | { status: "ok"; cliente: Cliente }
  | { status: "not_found" }
  | { status: "ambiguous" };

/**
 * Todas las fichas vivas con ese correo. **Solo el correo**: el teléfono dejó
 * de servir para entrar mientras no haya cómo probar que es de quien lo
 * escribe —quien se registra en la app demuestra su correo con un código, el
 * teléfono no lo demuestra nadie—. Vuelve cuando exista el código por WhatsApp.
 * `email` no es único, así que puede haber más de una.
 */
export async function clientesPorIdentificador(identifier: string): Promise<Cliente[]> {
  const trimmed = identifier.trim();
  if (!trimmed.includes("@")) return [];
  return prisma.cliente.findMany({
    where: {
      deletedAt: null,
      email: { equals: trimmed, mode: "insensitive" },
    },
  });
}

/**
 * Exactamente una ficha para ese identificador: 0 → not_found, >1 → ambiguous.
 * Es lo que necesita quien va a **vincular** algo a la ficha (el registro), que
 * no puede elegir a ciegas. Para entrar con contraseña ver
 * `validateClienteCredentials`, que con varias decide por la contraseña.
 */
export async function resolveClienteByIdentifier(
  identifier: string
): Promise<ResolveResult> {
  const matches = await clientesPorIdentificador(identifier);
  if (matches.length === 0) return { status: "not_found" };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "ok", cliente: matches[0] };
}

// ──────────────────────────────────────────────
// Crear + enviar invitación (correo y WhatsApp)
// ──────────────────────────────────────────────

/**
 * Genera un token de un solo uso, invalida los anteriores sin usar y envía el
 * enlace para establecer contraseña al **correo** del cliente. (Solo correo: no
 * se usa WhatsApp para esto.) Si el cliente no tiene correo, no se envía nada.
 * No revela si el cliente existe — los llamadores deben responder genéricamente.
 *
 * Devuelve lo que contestó el envío (`null` si no había a quién mandarlo): el
 * botón del portal decía «Invitación enviada» también cuando Gmail rechazaba
 * el correo, y nadie se enteraba hasta que el cliente decía que no le llegó.
 */
export async function createAndSendInvite(
  clienteId: string
): Promise<SendEmailResult | null> {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente || cliente.deletedAt || !cliente.email) return null;

  const enlace = await crearEnlaceParaCliente(clienteId);
  const envio = await sendSetPasswordEmail(cliente.email, cliente.nombre, enlace.url);
  if (!envio.success) {
    console.error(`[invitación] no se pudo enviar a ${cliente.email}: ${envio.error}`);
  }
  return envio;
}

// ──────────────────────────────────────────────
// Login del cliente (teléfono/correo + contraseña)
// ──────────────────────────────────────────────

/**
 * Entrar con correo y contraseña. Con varias fichas para el mismo correo entra
 * aquella cuya contraseña valida —la misma regla que un correo presente en el
 * equipo y en un cliente—, en vez de no dejar entrar a ninguna.
 */
export async function validateClienteCredentials(
  identifier: string,
  password: string
): Promise<{ user: User; clienteId: string } | null> {
  const candidatos = await clientesPorIdentificador(identifier);
  if (candidatos.length === 0) return null;

  const fichas = await prisma.cliente.findMany({
    where: { id: { in: candidatos.map((c) => c.id) } },
    include: { user: true },
  });
  for (const cliente of fichas) {
    if (!cliente.user?.password) continue;
    // Con el acceso revocado la contraseña deja de importar, igual que del lado
    // del equipo.
    if (cliente.user.accesoRevocadoEl) continue;
    if (await bcrypt.compare(password, cliente.user.password)) {
      return { user: cliente.user, clienteId: cliente.id };
    }
  }
  return null;
}
