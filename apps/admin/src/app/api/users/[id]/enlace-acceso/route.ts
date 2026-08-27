import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  crearEnlaceParaUsuario,
  VIGENCIA_TEXTO,
} from "@/lib/services/acceso.service";
import { sendEnlacePortalEmail } from "@/lib/email";

const bodySchema = z.object({
  /**
   * `invitacion` para quien nunca entró (dura una semana) y `restablecer` para
   * quien ya tiene contraseña (dura una hora).
   */
  tipo: z.enum(["invitacion", "restablecer"]).default("restablecer"),
  /**
   * Mandar el correo, o solo emitir el enlace para copiarlo.
   *
   * Copiar sin enviar es para cuando el correo no es el camino: la persona
   * está al lado, o se le manda por WhatsApp y un correo de más solo confunde.
   */
  enviarCorreo: z.boolean().default(true),
});

/**
 * Genera un enlace para que un usuario ya existente se ponga una contraseña
 * nueva, y se lo manda por correo.
 *
 * Es el mismo mecanismo que la invitación —la diferencia es solo que la cuenta
 * ya funciona— así que un admin puede usarlo tanto para el que perdió su
 * contraseña como para el que nunca llegó a abrir su invitación.
 *
 * Emitirlo **anula el anterior** que siguiera sin usar, así que generar uno
 * nuevo también sirve para cortar el que se mandó a la persona equivocada.
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
  const { tipo, enviarCorreo } = parsed.data;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      apellido: true,
      email: true,
      role: true,
      accesoRevocadoEl: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  // Un cliente no entra por acá: su identidad vive en la ficha del cliente y
  // su enlace se genera desde Clientes.
  if (user.role === "CLIENTE") {
    return NextResponse.json(
      { error: "Los clientes se invitan desde su ficha" },
      { status: 400 }
    );
  }

  // A alguien bloqueado se le puede emitir un enlace: usarlo es lo que le
  // devuelve el acceso. No se desbloquea acá porque entre generar el enlace y
  // que lo abra pasan horas, y en el medio la cuenta volvería a servir con la
  // contraseña vieja —sin que la persona haya hecho nada—, que es justo lo que
  // revocar quería evitar.
  const enlace = await crearEnlaceParaUsuario(user.id, tipo);

  let correoEnviado = false;
  if (enviarCorreo) {
    try {
      const res = await sendEnlacePortalEmail(
        user.email,
        [user.name, user.apellido].filter(Boolean).join(" "),
        enlace.url,
        tipo,
        VIGENCIA_TEXTO[tipo]
      );
      correoEnviado = res.success;
    } catch (err) {
      console.warn("No pudimos enviar el enlace por correo", err);
    }
  }

  return NextResponse.json({
    enlace: enlace.url,
    expiraEl: enlace.expiraEl.toISOString(),
    correoEnviado,
    correoIntentado: enviarCorreo,
  });
}
