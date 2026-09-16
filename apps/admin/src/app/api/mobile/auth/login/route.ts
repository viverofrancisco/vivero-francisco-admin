import { NextResponse } from "next/server";
import { loginSchema } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { validateCredentials } from "@/lib/auth-helpers";
import { enforceLoginLimit } from "@/lib/mobile/rate-limit";
import { issueTokenPair } from "@/lib/mobile/tokens";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  // El campo se llama `email` por historia: lo que llega puede ser un correo o
  // un usuario. Quien trabaja en el jardín no tiene correo.
  const { email: identificador, password } = parsed.data;

  const limit = await enforceLoginLimit(identificador);
  if (limit) {
    return NextResponse.json(
      { error: limit.reason, retryAfter: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const user = await validateCredentials(identificador, password);
  if (!user) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  // Un cliente entra por su propia pantalla, con teléfono o correo y la
  // contraseña que se puso él mismo; acá no, porque esto resuelve por `User` y
  // su identidad vive en la ficha del cliente.
  if (user.role === "CLIENTE") {
    return NextResponse.json(
      { error: "Los clientes inician sesión desde la pantalla de clientes." },
      { status: 403 }
    );
  }

  const personal = await prisma.personal.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  const deviceInfo =
    request.headers.get("user-agent")?.slice(0, 200) ?? null;

  const tokens = await issueTokenPair({
    userId: user.id,
    role: user.role,
    personalId: personal?.id ?? null,
    clienteId: null,
    deviceInfo,
  });

  return NextResponse.json({
    ...tokens,
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      apellido: user.apellido,
      email: user.email,
      usuario: user.usuario,
    },
  });
}
