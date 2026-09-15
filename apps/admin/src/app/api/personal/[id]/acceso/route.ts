import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { setAccesoPersonal } from "@/lib/services/personal-acceso.service";

const bodySchema = z.object({ revocado: z.boolean() });

/**
 * Corta o devuelve el acceso de alguien del campo.
 *
 * No borra la cuenta: su nombre sigue firmando los partes que cargó. Ver
 * `revocarAcceso()` para qué se corta exactamente.
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
    const estado = await setAccesoPersonal(id, parsed.data.revocado);
    return NextResponse.json({ estado });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
