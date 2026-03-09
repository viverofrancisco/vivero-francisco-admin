import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { completarVisitaSchema } from "@/lib/validations/visita";

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

  if (data.estado === "INCOMPLETA" && !data.nuevaFechaProgramada) {
    return NextResponse.json(
      { error: "Debes indicar una nueva fecha para reagendar la visita incompleta" },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const visitaActualizada = await tx.visita.update({
      where: { id },
      data: {
        estado: data.estado,
        fechaRealizada: new Date(data.fechaRealizada),
        notas: data.notas || visita.notas,
        notasIncompleto: data.notasIncompleto || null,
        updatedById: user.id,
      },
    });

    if (data.estado === "INCOMPLETA" && data.nuevaFechaProgramada) {
      await tx.visita.create({
        data: {
          clienteServicioId: visita.clienteServicioId,
          fechaProgramada: new Date(data.nuevaFechaProgramada),
          grupoId: visita.grupoId,
          visitaOrigenId: id,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    }

    return visitaActualizada;
  });

  return NextResponse.json(updated);
}
