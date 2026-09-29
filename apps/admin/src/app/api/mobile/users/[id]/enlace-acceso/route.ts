import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { emitirEnlaceParaUsuario } from "@/lib/services/acceso.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const bodySchema = z.object({
  tipo: z.enum(["invitacion", "restablecer"]).default("restablecer"),
  enviarCorreo: z.boolean().default(false),
});

/**
 * Gemela de `POST /api/users/[id]/enlace-acceso`: desde la app, un ADMIN emite
 * el enlace para que alguien del equipo se ponga contraseña —la invitación de
 * quien nunca entró, o el restablecimiento de quien la perdió— y lo copia o
 * lo comparte por WhatsApp. Por defecto sin correo: el personal de campo no
 * tiene casilla.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await emitirEnlaceParaUsuario(id, parsed.data.tipo, parsed.data.enviarCorreo)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
