import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { clienteServicioSchema } from "@/lib/validations/cliente-servicio";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; asignacionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { asignacionId } = await params;
  const body = await request.json();
  const result = clienteServicioSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const asignacion = await prisma.clienteServicio.update({
      where: { id: asignacionId },
      data: {
        precio: data.precio,
        iva: data.iva,
        frecuenciaMensual: data.frecuenciaMensual ?? null,
        estado: data.estado,
        fechaInicio: new Date(data.fechaInicio),
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
        notas: data.notas || null,
        updatedById: user.id,
      },
      include: { servicio: true },
    });

    return NextResponse.json({ ...asignacion, precio: Number(asignacion.precio), iva: Number(asignacion.iva) });
  } catch {
    return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; asignacionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { asignacionId } = await params;

  try {
    await prisma.clienteServicio.delete({ where: { id: asignacionId } });
    return NextResponse.json({ message: "Asignación eliminada" });
  } catch {
    return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
  }
}
