import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { cambiarUsuarioPersonal } from "@/lib/services/personal-acceso.service";

const bodySchema = z.object({ usuario: z.string().min(1).max(60) });

/**
 * Le cambia el usuario.
 *
 * La cuenta se crea sola con la ficha, así que esto no crea nada: existe porque
 * el usuario se genera a partir del nombre y a veces sale mal —un apodo cargado
 * como nombre, dos personas que se llaman igual y quedó `fherrera2`— y borrar la
 * cuenta para arreglarlo se llevaría el historial de quién cargó cada parte.
 */
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
