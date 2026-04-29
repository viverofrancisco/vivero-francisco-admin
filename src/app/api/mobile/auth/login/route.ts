import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateCredentials } from "@/lib/auth-helpers";
import { enforceLoginLimit } from "@/lib/mobile/rate-limit";
import { issueTokenPair } from "@/lib/mobile/tokens";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const limit = await enforceLoginLimit(email);
  if (limit) {
    return NextResponse.json(
      { error: limit.reason, retryAfter: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const user = await validateCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  if (user.role === "CLIENTE") {
    return NextResponse.json(
      { error: "Los clientes deben iniciar sesión con código de WhatsApp." },
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
    },
  });
}
