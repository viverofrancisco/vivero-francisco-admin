import { NextResponse } from "next/server";
import { requestInviteSchema } from "@vivero/shared";
import { enforceLoginLimit } from "@/lib/mobile/rate-limit";
import {
  clientesPorIdentificador,
  createAndSendInvite,
} from "@/lib/services/cliente-invite.service";

// Mensaje genérico: no revelamos si el identificador corresponde a un cliente.
const GENERIC_MESSAGE =
  "Si tu cuenta existe, te enviamos un enlace por correo para crear tu contraseña.";

export async function POST(request: Request) {
  const parsed = requestInviteSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { identifier } = parsed.data;

  const limit = await enforceLoginLimit(identifier);
  if (limit) {
    return NextResponse.json(
      { error: limit.reason, retryAfter: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  // Solo por correo (ver `clientesPorIdentificador`). Con varias fichas con el
  // mismo correo, el enlace sale a cada una: es el mismo buzón.
  const fichas = await clientesPorIdentificador(identifier);
  for (const ficha of fichas.slice(0, 5)) {
    await createAndSendInvite(ficha.id);
  }

  // Siempre 200 genérico (incluye not_found y ambiguous).
  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
