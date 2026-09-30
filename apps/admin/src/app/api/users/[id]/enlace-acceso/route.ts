import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth-helpers";
import { emitirEnlaceParaUsuario } from "@/lib/services/acceso.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const bodySchema = z.object({
  /**
   * `invitacion` para quien nunca entró (dura una semana) y `restablecer` para
   * quien ya tiene contraseña (dura una hora).
   */
  tipo: z.enum(["invitacion", "restablecer"]).default("restablecer"),
  /**
   * Mandar el correo, o solo emitir el enlace para copiarlo. Por defecto no:
   * el portal lo genera y lo muestra, y *Enviar por correo* es un botón aparte
   * (`/enlace-acceso/enviar`), que no emite otro.
   *
   * Copiar sin enviar es para cuando el correo no es el camino: la persona
   * está al lado, o se le manda por WhatsApp y un correo de más solo confunde.
   */
  enviarCorreo: z.boolean().default(false),
});

/**
 * Genera un enlace para que un usuario ya existente se ponga una contraseña
 * nueva, y se lo manda por correo. El cuerpo vive en
 * `emitirEnlaceParaUsuario`, que también usa la ruta móvil.
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
      await emitirEnlaceParaUsuario(id, parsed.data.tipo, parsed.data.enviarCorreo)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
