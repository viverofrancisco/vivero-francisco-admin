import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jardineroSchema } from "@/lib/validations/jardinero";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const jardinero = await prisma.jardinero.findUnique({ where: { id } });

  if (!jardinero) {
    return NextResponse.json({ error: "Jardinero no encontrado" }, { status: 404 });
  }

  return NextResponse.json(jardinero);
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
  const result = jardineroSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const jardinero = await prisma.jardinero.update({
      where: { id },
      data: {
        nombre: data.nombre,
        telefono: data.telefono || null,
        email: data.email || null,
        especialidad: data.especialidad || null,
        disponible: data.disponible,
        updatedById: user.id,
      },
    });
    return NextResponse.json(jardinero);
  } catch {
    return NextResponse.json({ error: "Jardinero no encontrado" }, { status: 404 });
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

  try {
    await prisma.jardinero.delete({ where: { id } });
    return NextResponse.json({ message: "Jardinero eliminado" });
  } catch {
    return NextResponse.json({ error: "Jardinero no encontrado" }, { status: 404 });
  }
}
