import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { servicioSchema } from "@/lib/validations/servicio";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const servicios = await prisma.servicio.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clientes: true } } },
  });

  return NextResponse.json(servicios);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const result = servicioSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const servicio = await prisma.servicio.create({
    data: {
      nombre: data.nombre,
      descripcion: data.descripcion || null,
      tipo: data.tipo,
      createdById: user.id,
      updatedById: user.id,
    },
  });

  return NextResponse.json(servicio, { status: 201 });
}
