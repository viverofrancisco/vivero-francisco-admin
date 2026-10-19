import { NextResponse } from "next/server";
import { verificarCodigoDeRegistroSchema } from "@vivero/shared";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { comprobarCodigoDeRegistro } from "@/lib/services/registro-cliente.service";

/**
 * Crear una cuenta con la contraseña **después** del código: si el código es
 * el bueno, la app pasa a pedir la contraseña, y `confirmar` crea la cuenta
 * con los dos. No consume el código; un error suma un intento.
 */
export async function POST(request: Request) {
  const parsed = verificarCodigoDeRegistroSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    await comprobarCodigoDeRegistro(parsed.data.email, parsed.data.codigo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
