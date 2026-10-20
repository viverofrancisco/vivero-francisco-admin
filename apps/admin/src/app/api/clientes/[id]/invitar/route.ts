import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { createAndSendInvite } from "@/lib/services/cliente-invite.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, email: true },
  });
  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }
  if (!cliente.email) {
    return NextResponse.json(
      { error: "El cliente no tiene correo registrado. Agrega uno para enviar la invitación." },
      { status: 400 }
    );
  }

  const envio = await createAndSendInvite(cliente.id);
  if (envio && !envio.success) {
    return NextResponse.json(
      { error: "No se pudo enviar el correo. Inténtalo de nuevo en un momento." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Invitación enviada al cliente.",
  });
}
