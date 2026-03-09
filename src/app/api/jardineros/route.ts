import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { jardineroSchema } from "@/lib/validations/jardinero";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const jardineros = await prisma.jardinero.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(jardineros);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const result = jardineroSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const jardinero = await prisma.jardinero.create({
    data: {
      nombre: data.nombre,
      telefono: data.telefono || null,
      email: data.email || null,
      especialidad: data.especialidad || null,
      disponible: data.disponible,
      createdById: user.id,
      updatedById: user.id,
    },
  });

  return NextResponse.json(jardinero, { status: 201 });
}
