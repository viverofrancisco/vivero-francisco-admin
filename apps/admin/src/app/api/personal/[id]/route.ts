import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revocarAcceso } from "@/lib/services/acceso.service";
import { personalSchema } from "@/lib/validations/personal";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const personal = await prisma.personal.findUnique({ where: { id, deletedAt: null } });

  if (!personal) {
    return NextResponse.json({ error: "Personal no encontrado" }, { status: 404 });
  }

  return NextResponse.json(personal);
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
  const result = personalSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const personal = await prisma.personal.update({
      where: { id },
      data: {
        nombre: data.nombre,
        apellido: data.apellido || null,
        telefono: data.telefono || null,

        especialidad: data.especialidad || null,
        sueldo: data.sueldo || null,
        estado: data.estado,
        tipo: data.tipo || null,
        updatedById: user.id,
      },
    });
    return NextResponse.json(personal);
  } catch {
    return NextResponse.json({ error: "Personal no encontrado" }, { status: 404 });
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
    const personal = await prisma.personal.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { userId: true },
    });
    // Archivar a alguien le corta el acceso: su ficha desaparece de las listas
    // y la app no le muestra nada, pero su cuenta seguía entrando —y con ella
    // el chat de las visitas—. La cuenta no se borra: su nombre firma los
    // partes que cargó, y devolverle el acceso es un clic si vuelve.
    if (personal.userId) await revocarAcceso(personal.userId);
    return NextResponse.json({ message: "Personal archivado" });
  } catch {
    return NextResponse.json({ error: "Personal no encontrado" }, { status: 404 });
  }
}
