import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import {
  cambiarUsuarioPersonal,
  crearCuentaPersonal,
} from "@/lib/services/personal-acceso.service";

const bodySchema = z.object({ usuario: z.string().min(1).max(60) });

/**
 * Le crea la cuenta a alguien del campo.
 *
 * Solo un ADMIN: es dar acceso al portal, y la lista de quién entra tiene que
 * tener un dueño. Devuelve el enlace **una sola vez** —en la base queda su
 * sha256— así que la pantalla lo muestra hasta que lo cierren.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const { estado, enlace, expiraEl } = await crearCuentaPersonal(
      id,
      parsed.data.usuario
    );
    return NextResponse.json(
      { estado, enlace, expiraEl: expiraEl.toISOString() },
      { status: 201 }
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Le cambia el usuario —un tipeo no debería costar la cuenta entera. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const estado = await cambiarUsuarioPersonal(id, parsed.data.usuario);
    return NextResponse.json({ estado });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
