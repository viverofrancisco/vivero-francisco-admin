import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { nombreCliente } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/mobile/jwt";
import { formatForWhatsApp } from "@/lib/whatsapp/phone";
import { sendSetPasswordEmail } from "@/lib/email";
import type { Cliente, User } from "@/generated/prisma/client";

// Los enlaces de invitación / restablecimiento caducan a las 24 horas.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

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

  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.setPasswordToken.updateMany({
      where: { clienteId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.setPasswordToken.create({ data: { clienteId, tokenHash, expiresAt } }),
  ]);

  const link = `${baseUrl()}/establecer-contrasena?token=${token}`;
  await sendSetPasswordEmail(cliente.email, cliente.nombre, link);
}

// ──────────────────────────────────────────────
// Establecer contraseña a partir del token
// ──────────────────────────────────────────────

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Valida el token y establece la contraseña del cliente. Crea o reutiliza su
 * `User` (rol CLIENTE) y lo enlaza a la ficha. El `User.email` se mantiene como
 * placeholder — el inicio de sesión resuelve por la ficha del cliente, no por
 * `User.email`, evitando colisiones con correos del personal.
 */
export async function setPasswordWithToken(
  token: string,
  password: string
): Promise<SetPasswordResult> {
  const tokenHash = sha256(token);
  const record = await prisma.setPasswordToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt) return { ok: false, reason: "invalid" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  const cliente = await prisma.cliente.findUnique({ where: { id: record.clienteId } });
  if (!cliente || cliente.deletedAt) return { ok: false, reason: "invalid" };

  const hashed = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    let userId: string | null = cliente.userId;

    if (userId) {
      const existing = await tx.user.findUnique({ where: { id: userId } });
      if (existing) {
        await tx.user.update({ where: { id: userId }, data: { password: hashed } });
      } else {
        userId = null;
      }
    }

    if (!userId) {
      const created = await tx.user.create({
        data: {
          role: "CLIENTE",
          email: `cliente+${cliente.id}@viverofrancisco.local`,
          password: hashed,
        },
      });
      await tx.cliente.update({
        where: { id: cliente.id },
        data: { userId: created.id },
      });
    }

    await tx.setPasswordToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  });

  return { ok: true };
}

/**
 * Datos mínimos para que la página de establecer contraseña salude al cliente.
 */
export async function getInviteTokenInfo(
  token: string
): Promise<{ valid: boolean; nombre?: string }> {
  const record = await prisma.setPasswordToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      cliente: {
        select: { nombre: true, apellido: true, empresa: true, deletedAt: true },
      },
    },
  });
  if (
    !record ||
    record.usedAt ||
    record.expiresAt.getTime() < Date.now() ||
    record.cliente.deletedAt
  ) {
    return { valid: false };
  }
  return { valid: true, nombre: nombreCliente(record.cliente) };
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
