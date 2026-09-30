import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth-helpers";
import { enviarEnlacePorCorreo } from "@/lib/services/acceso.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const bodySchema = z.object({
  enlace: z.string().min(10),
  tipo: z.enum(["invitacion", "restablecer"]),
});

/**
 * Manda por correo el enlace que se acaba de generar, sin emitir otro. Ver
 * `enviarEnlacePorCorreo`.
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
    return NextResponse.json(
      await enviarEnlacePorCorreo(id, parsed.data.enlace, parsed.data.tipo)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
