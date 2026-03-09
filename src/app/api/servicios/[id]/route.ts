import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { servicioSchema } from "@/lib/validations/servicio";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const servicio = await prisma.servicio.findUnique({ where: { id } });

  if (!servicio) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  return NextResponse.json(servicio);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const result = servicioSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const servicio = await prisma.servicio.update({
      where: { id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        tipo: data.tipo,
        updatedById: user.id,
      },
    });
    return NextResponse.json(servicio);
  } catch {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const asignaciones = await prisma.clienteServicio.count({
    where: { servicioId: id },
  });

  if (asignaciones > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar un servicio asignado a clientes" },
      { status: 409 }
    );
  }

  try {
    await prisma.servicio.delete({ where: { id } });
    return NextResponse.json({ message: "Servicio eliminado" });
  } catch {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
}
