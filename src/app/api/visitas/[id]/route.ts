import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { visitaSchema } from "@/lib/validations/visita";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const visita = await prisma.visita.findUnique({
    where: { id },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { id: true, nombre: true, ciudad: true, sector: true } },
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      grupo: {
        select: {
          id: true,
          nombre: true,
          miembros: {
            include: { jardinero: { select: { id: true, nombre: true } } },
          },
        },
      },
      visitaOrigen: { select: { id: true, fechaProgramada: true, estado: true } },
      visitasReagendadas: { select: { id: true, fechaProgramada: true, estado: true } },
    },
  });

  if (!visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  return NextResponse.json(visita);
}

export async function PUT(
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
  const result = visitaSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const visita = await prisma.visita.update({
      where: { id },
      data: {
        fechaProgramada: new Date(data.fechaProgramada),
        grupoId: data.grupoId || null,
        notas: data.notas || null,
        updatedById: user.id,
      },
    });
    return NextResponse.json(visita);
  } catch {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
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

  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.visita.delete({ where: { id } });
    return NextResponse.json({ message: "Visita eliminada" });
  } catch {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }
}
