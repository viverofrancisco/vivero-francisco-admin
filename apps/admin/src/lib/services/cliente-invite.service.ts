import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { formatForWhatsApp } from "@/lib/whatsapp/phone";
import { sendSetPasswordEmail } from "@/lib/email";
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
 * Resuelve un cliente a partir de un identificador que puede ser su correo o su
 * teléfono. El teléfono se normaliza al formato de WhatsApp antes de comparar.
 * Como `email`/`telefono` no son únicos en el modelo, se exige exactamente una
 * coincidencia (igual que hacía el flujo de OTP): 0 → not_found, >1 → ambiguous.
 */
export async function resolveClienteByIdentifier(
  identifier: string
): Promise<ResolveResult> {
  const trimmed = identifier.trim();
  if (!trimmed) return { status: "not_found" };

  if (trimmed.includes("@")) {
    const matches = await prisma.cliente.findMany({
      where: {
        deletedAt: null,
        email: { equals: trimmed, mode: "insensitive" },
      },
    });
    if (matches.length === 0) return { status: "not_found" };
    if (matches.length > 1) return { status: "ambiguous" };
    return { status: "ok", cliente: matches[0] };
  }

  const normalized = formatForWhatsApp(trimmed);
  const conTelefono = await prisma.cliente.findMany({
    where: { deletedAt: null, telefono: { not: null } },
  });
  const candidates = conTelefono.filter(
    (c) => c.telefono && formatForWhatsApp(c.telefono) === normalized
  );
  if (candidates.length === 0) return { status: "not_found" };
  if (candidates.length > 1) return { status: "ambiguous" };
  return { status: "ok", cliente: candidates[0] };
}

// ──────────────────────────────────────────────
// Crear + enviar invitación (correo y WhatsApp)
// ──────────────────────────────────────────────

/**
 * Genera un token de un solo uso, invalida los anteriores sin usar y envía el
 * enlace para establecer contraseña al **correo** del cliente. (Solo correo: no
 * se usa WhatsApp para esto.) Si el cliente no tiene correo, no se envía nada.
 * No revela si el cliente existe — los llamadores deben responder genéricamente.
 */
export async function createAndSendInvite(clienteId: string): Promise<void> {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente || cliente.deletedAt || !cliente.email) return;

  const enlace = await crearEnlaceParaCliente(clienteId);
  await sendSetPasswordEmail(cliente.email, cliente.nombre, enlace.url);
}

// ──────────────────────────────────────────────
// Login del cliente (teléfono/correo + contraseña)
// ──────────────────────────────────────────────

/**
 * Resuelve el cliente por identificador y valida la contraseña contra su `User`.
 * Devuelve el `{ user, clienteId }` en caso de éxito o null en cualquier fallo
 * (no distingue entre identificador inexistente y contraseña incorrecta).
 */
export async function validateClienteCredentials(
  identifier: string,
  password: string
): Promise<{ user: User; clienteId: string } | null> {
  const resolved = await resolveClienteByIdentifier(identifier);
  if (resolved.status !== "ok") return null;

  const cliente = await prisma.cliente.findUnique({
    where: { id: resolved.cliente.id },
    include: { user: true },
  });
  if (!cliente?.user?.password) return null;

  const valid = await bcrypt.compare(password, cliente.user.password);
  if (!valid) return null;

  return { user: cliente.user, clienteId: cliente.id };
}
