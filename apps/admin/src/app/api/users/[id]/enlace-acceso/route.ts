import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  crearEnlaceParaUsuario,
  VIGENCIA_TEXTO,
} from "@/lib/services/acceso.service";
import { sendEnlacePortalEmail } from "@/lib/email";

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, apellido: true, email: true, role: true },
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

  const enlace = await crearEnlaceParaUsuario(user.id, "restablecer");

  let correoEnviado = false;
  try {
    const res = await sendEnlacePortalEmail(
      user.email,
      [user.name, user.apellido].filter(Boolean).join(" "),
      enlace.url,
      "restablecer",
      VIGENCIA_TEXTO.restablecer
    );
    correoEnviado = res.success;
  } catch (err) {
    console.warn("No pudimos enviar el enlace por correo", err);
  }

  return NextResponse.json({
    enlace: enlace.url,
    expiraEl: enlace.expiraEl.toISOString(),
    correoEnviado,
  });
}
