import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { sectorSchema } from "@/lib/validations/sector";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const sector = await prisma.sector.findUnique({
    where: { id },
    include: {
      _count: { select: { clientes: true } },
      clientes: {
        select: { id: true, nombre: true, ciudad: true },
        orderBy: { nombre: "asc" },
      },
      admins: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!sector) {
    return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 });
  }

  return NextResponse.json(sector);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const result = sectorSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  try {
    const sector = await prisma.sector.update({
      where: { id },
      data: { nombre: result.data.nombre.trim() },
    });
    return NextResponse.json(sector);
  } catch {
    return NextResponse.json(
      { error: "Sector no encontrado o nombre duplicado" },
      { status: 409 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const clienteCount = await prisma.cliente.count({
    where: { sectorId: id },
  });

  if (clienteCount > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${clienteCount} cliente(s) asignado(s)` },
      { status: 409 }
    );
  }

  try {
    await prisma.sector.delete({ where: { id } });
    return NextResponse.json({ message: "Sector eliminado" });
  } catch {
    return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 });
  }
}
