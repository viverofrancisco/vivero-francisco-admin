import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { personalSchema } from "@/lib/validations/personal";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const personal = await prisma.personal.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(personal);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const result = personalSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const personal = await prisma.personal.create({
    data: {
      nombre: data.nombre,
      apellido: data.apellido || null,
      telefono: data.telefono || null,

      especialidad: data.especialidad || null,
      sueldo: data.sueldo || null,
      estado: data.estado,
      tipo: data.tipo || null,
      createdById: user.id,
      updatedById: user.id,
    },
  });

  return NextResponse.json(personal, { status: 201 });
}
