import { NextResponse } from "next/server";
import { correoRegistroSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { enforceRegistroLimit } from "@/lib/mobile/rate-limit";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { pedirCodigoDeCambioDeCorreo } from "@/lib/services/cambio-de-correo.service";

/**
 * Cambiar el correo, primer paso: el correo nuevo, y el código a ese correo.
 * Solo el cliente; el del equipo lo cambia un administrador desde el portal.
 */
export async function POST(request: Request) {
  const user = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(user)) return user;
  if (!user.clienteId) {
    return NextResponse.json({ error: "Sin cliente" }, { status: 403 });
  }

  const parsed = correoRegistroSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Escribe un correo válido" },
      { status: 400 }
    );
  }

  // Manda un correo, como el registro: el mismo límite por casilla y por IP.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limite = await enforceRegistroLimit(parsed.data.email, ip);
  if (limite) {
    return NextResponse.json(
      { error: limite.reason, retryAfter: limite.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
    );
  }

  try {
    await pedirCodigoDeCambioDeCorreo(user.id, user.clienteId, parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
