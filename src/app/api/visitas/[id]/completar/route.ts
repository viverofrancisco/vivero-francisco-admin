import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { completarVisitaSchema } from "@/lib/validations/visita";
import {
  enviarAlertaVisitaCompletada,
  enviarAlertaVisitaIncompleta,
} from "@/lib/whatsapp/service";
import {
  pushAlertaCompletada,
  pushAlertaIncompleta,
} from "@/lib/push/triggers";

export async function POST(
  request: Request,
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
  const body = await request.json();
  const result = completarVisitaSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  const visita = await prisma.visita.findUnique({ where: { id } });
  if (!visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  if (visita.estado !== "PROGRAMADA") {
    return NextResponse.json(
      { error: "Solo se pueden completar visitas programadas" },
      { status: 400 }
    );
  }

  const updated = await prisma.visita.update({
    where: { id },
    data: {
      estado: data.estado,
      fechaRealizada: new Date(data.fechaRealizada),
      horaEntrada: data.horaEntrada || null,
      horaSalida: data.horaSalida || null,
      notas: data.notas || visita.notas,
      notasIncompleto: data.notasIncompleto || null,
      updatedById: user.id,
    },
  });

  // Fire-and-forget notifications (WhatsApp + push en paralelo)
  if (data.estado === "COMPLETADA") {
    enviarAlertaVisitaCompletada(id).catch(console.error);
    pushAlertaCompletada(id).catch(console.error);
  } else if (data.estado === "INCOMPLETA" || data.estado === "CANCELADA") {
    enviarAlertaVisitaIncompleta(id).catch(console.error);
    pushAlertaIncompleta(id).catch(console.error);
  }

  return NextResponse.json(updated);
}
