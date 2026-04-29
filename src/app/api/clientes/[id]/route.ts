import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { clienteSchema } from "@/lib/validations/cliente";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id, deletedAt: null } });

  if (!cliente) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json(cliente);
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
  const result = clienteSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nombre: data.nombre,
        apellido: data.apellido || null,
        email: data.email || null,
        telefono: data.telefono || null,
        ciudad: data.ciudad || null,
        direccion: data.direccion || null,
        numeroCasa: data.numeroCasa || null,
        referencia: data.referencia || null,
        notas: data.notas || null,
        metrosCuadrados: data.metrosCuadrados || null,
        updatedById: user.id,
      },
    });
    return NextResponse.json(cliente);
  } catch {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
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
    await prisma.cliente.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Cliente archivado" });
  } catch {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }
}
