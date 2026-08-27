import { NextResponse } from "next/server";
import { setPasswordSchema } from "@vivero/shared";
import {
  establecerContrasena,
  infoDeEnlace,
} from "@/lib/services/acceso.service";

// Público: validar el token del enlace para mostrar el estado en la página.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  const info = await infoDeEnlace(token);
  return NextResponse.json({
    valid: info.valido,
    nombre: info.nombre,
    destino: info.destino,
    motivo: info.motivo,
  });
}

// Público: establecer la contraseña a partir del token.
export async function POST(request: Request) {
  const parsed = setPasswordSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;
  const result = await establecerContrasena(token, password);

  if (!result.ok) {
    const message =
      result.motivo === "vencido"
        ? "El enlace caducó. Solicita uno nuevo."
        : "El enlace no es válido o ya fue usado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, destino: result.destino });
}
