import { NextResponse } from "next/server";
import { clienteLoginSchema } from "@vivero/shared";
import { enforceLoginLimit } from "@/lib/mobile/rate-limit";
import { issueTokenPair } from "@/lib/mobile/tokens";
import { validateClienteCredentials } from "@/lib/services/cliente-invite.service";

export async function POST(request: Request) {
  const parsed = clienteLoginSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { identifier, password } = parsed.data;

  const limit = await enforceLoginLimit(identifier);
  if (limit) {
    return NextResponse.json(
      { error: limit.reason, retryAfter: limit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const result = await validateClienteCredentials(identifier, password);
  if (!result) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const deviceInfo = request.headers.get("user-agent")?.slice(0, 200) ?? null;

  const tokens = await issueTokenPair({
    userId: result.user.id,
    role: "CLIENTE",
    personalId: null,
    clienteId: result.clienteId,
    deviceInfo,
  });

  return NextResponse.json({
    ...tokens,
    user: {
      id: result.user.id,
      role: "CLIENTE",
      name: result.user.name,
      apellido: result.user.apellido,
    },
  });
}
