import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { sectorSchema } from "@/lib/validations/sector";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Los sectores agrupan clientes, y quién los mira es la oficina. Tenían
  // además administradores —el rol que acotaba a un capataz a los suyos— y eso
  // se fue con el rol: hoy un sector es solo una etiqueta geográfica.
  if (user.role === "PERSONAL" || user.role === "CLIENTE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const sectores = await prisma.sector.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    include: { _count: { select: { clientes: true } } },
  });

  return NextResponse.json(sectores);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = sectorSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  try {
    const sector = await prisma.sector.create({
      data: { nombre: result.data.nombre.trim() },
    });
    return NextResponse.json(sector, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ya existe un sector con ese nombre" },
      { status: 409 }
    );
  }
}
