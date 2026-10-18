import { NextResponse } from "next/server";
import { correoRegistroSchema } from "@vivero/shared";
import { enforceCorreoRegistroLimit } from "@/lib/mobile/rate-limit";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { correoParaRegistro } from "@/lib/services/registro-cliente.service";

/**
 * ¿Sirve este correo para crear una cuenta? La app lo pregunta mientras se
 * escribe, para marcar el campo en rojo antes de *Continuar*. Sin sesión, como
 * el registro; el primer paso lo vuelve a revisar.
 */
export async function POST(request: Request) {
  const parsed = correoRegistroSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { disponible: false, motivo: parsed.error.issues[0]?.message ?? "Escribe un correo válido" },
      { status: 200 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limite = await enforceCorreoRegistroLimit(ip);
  if (limite) {
    return NextResponse.json(
      { error: limite.reason, retryAfter: limite.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } }
    );
  }

  try {
    return NextResponse.json(await correoParaRegistro(parsed.data.email));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
