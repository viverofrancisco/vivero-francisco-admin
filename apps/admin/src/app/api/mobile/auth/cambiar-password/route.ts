import { NextResponse } from "next/server";
import { cambiarPasswordSchema } from "@vivero/shared";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { cambiarContrasenaPropia } from "@/lib/services/acceso.service";

/**
 * Cambiar la propia contraseña desde la app.
 *
 * **Sin enlace, a propósito.** El enlace de un solo uso existe para quien no
 * puede entrar —nadie le escribe la contraseña a nadie, y el jardinero no tiene
 * correo al cual mandársela—. Quien ya tiene la sesión abierta prueba quién es
 * escribiendo la que está usando, que es la misma garantía y no depende de un
 * canal que esa persona no tiene.
 *
 * Solo la propia: no recibe un `userId`. Cambiarle la contraseña a otro sigue
 * siendo emitirle un enlace desde su ficha.
 */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = cambiarPasswordSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "La contraseña nueva tiene que tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  const { actual, nueva, refreshToken } = parsed.data;
  const r = await cambiarContrasenaPropia(
    userOrResponse.id,
    actual,
    nueva,
    refreshToken
  );

  if (!r.ok) {
    return NextResponse.json(
      {
        error:
          r.motivo === "incorrecta"
            ? "La contraseña actual no es correcta."
            : "Tu cuenta todavía no tiene contraseña.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
