import { NextResponse } from "next/server";
import { registroSchema } from "@vivero/shared";
import { enforceRegistroLimit } from "@/lib/mobile/rate-limit";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { solicitarCodigoDeRegistro } from "@/lib/services/registro-cliente.service";

/**
 * Crear una cuenta de cliente, primer paso: los datos, y el código al correo.
 * Sin sesión, como el login. Ver `registro-cliente.service.ts`.
 */
export async function POST(request: Request) {
  const parsed = registroSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limite = await enforceRegistroLimit(parsed.data.email, ip);
  if (limite) {
    return NextResponse.json(
      { error: limite.reason, retryAfter: limite.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
    );
  }

  try {
    await solicitarCodigoDeRegistro(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
