import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserSectorIds } from "@/lib/auth-helpers";
import { sectorSchema } from "@/lib/validations/sector";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (user.role === "JARDINERO_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    const sectores = await prisma.sector.findMany({
      where: { id: { in: sectorIds } },
      orderBy: { nombre: "asc" },
      include: { _count: { select: { clientes: true } } },
    });
    return NextResponse.json(sectores);
  }

  if (user.role === "JARDINERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const sectores = await prisma.sector.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { clientes: true } },
      admins: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
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
