import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { reagendarVisitaSchema } from "@/lib/validations/visita";

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
  const result = reagendarVisitaSchema.safeParse(body);

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
      { error: "Solo se pueden reagendar visitas programadas" },
      { status: 400 }
    );
  }

  const nuevaVisita = await prisma.$transaction(async (tx) => {
    await tx.visita.update({
      where: { id },
      data: {
        estado: "REAGENDADA",
        notas: data.notas || visita.notas,
        updatedById: user.id,
      },
    });

    return tx.visita.create({
      data: {
        clienteServicioId: visita.clienteServicioId,
        fechaProgramada: new Date(data.nuevaFecha),
        grupoId: visita.grupoId,
        visitaOrigenId: id,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  });

  return NextResponse.json(nuevaVisita, { status: 201 });
}
