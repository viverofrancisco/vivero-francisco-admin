import { NextResponse } from "next/server";
import { loginSchema } from "@vivero/shared";
import { enforceLoginLimit } from "@/lib/mobile/rate-limit";
import { issueTokenPair } from "@/lib/mobile/tokens";
import { autenticarEnLaApp } from "@/lib/services/login-app.service";

/**
 * Entrar a la app. **Una sola puerta para los cuatro roles.**
 *
 * Antes esta ruta era la del equipo y rechazaba al cliente con un 403 que lo
 * mandaba a otra pantalla; el cliente tenía la suya, contra su ficha. Quién es
 * cada uno lo resuelve ahora `autenticarEnLaApp`, que es donde se puede
 * resolver: la app no tiene forma de saberlo antes de preguntar, y preguntarle
 * a la persona de qué lado del negocio está es hacerle una pregunta nuestra.
 *
 * El campo se llama `email` por historia y acepta cualquier cosa: un usuario
 * dictado por teléfono, un correo o el número del cliente.
 */
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { email: identificador, password } = parsed.data;

  const limit = await enforceLoginLimit(identificador);
  if (limit) {
    return NextResponse.json(
      { error: limit.reason, retryAfter: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const sesion = await autenticarEnLaApp(identificador, password);
  if (!sesion) {
    // Un solo mensaje para todo: identificador que no existe, contraseña
    // equivocada, acceso revocado. Distinguirlos le dice a quien prueba cuáles
    // de sus intentos existen.
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const deviceInfo = request.headers.get("user-agent")?.slice(0, 200) ?? null;

  const tokens = await issueTokenPair({
    userId: sesion.user.id,
    role: sesion.role,
    personalId: sesion.personalId,
    clienteId: sesion.clienteId,
    deviceInfo,
  });

  return NextResponse.json({
    ...tokens,
    user: {
      id: sesion.user.id,
      role: sesion.role,
      name: sesion.user.name,
      apellido: sesion.user.apellido,
      email: sesion.user.email,
      usuario: sesion.user.usuario,
    },
  });
}
