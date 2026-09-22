import { NextResponse } from "next/server";
import { cambiarPasswordSchema } from "@vivero/shared";
import { getCurrentUser } from "@/lib/auth-helpers";
import { cambiarContrasenaPropia } from "@/lib/services/acceso.service";

/**
 * Cambiar la propia contraseña desde el portal. Es la misma regla que la ruta
 * de la app: quien ya está adentro prueba quién es escribiendo la que usa, y
 * solo cambia la suya —a otro se le emite un enlace desde su ficha—.
 *
 * Sin `refreshToken`: la sesión del portal es un JWT, no hay teléfono que
 * conservar, así que se revocan **todas** las sesiones de la app. Es lo que
 * uno quiere cuando cambia la contraseña porque alguien más la sabía.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = cambiarPasswordSchema
    .omit({ refreshToken: true })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "La contraseña nueva tiene que tener al menos 6 caracteres." },
      { status: 400 }
    );
  }

  const r = await cambiarContrasenaPropia(
    user.id,
    parsed.data.actual,
    parsed.data.nueva
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
