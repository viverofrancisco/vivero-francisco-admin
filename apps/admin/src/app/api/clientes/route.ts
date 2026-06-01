import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserSectorIds, isReadOnly } from "@/lib/auth-helpers";
import { clienteSchema } from "@/lib/validations/cliente";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (user.role === "PERSONAL") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const where: Record<string, unknown> = {};

  if (user.role === "PERSONAL_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    where.sectorId = { in: sectorIds };
  }

  const clientes = await prisma.cliente.findMany({
    where: { ...where, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      sector: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json(clientes);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isReadOnly(user.role) || user.role === "PERSONAL_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = clienteSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  const cliente = await prisma.cliente.create({
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
      createdById: user.id,
      updatedById: user.id,
    },
  });

  return NextResponse.json(cliente, { status: 201 });
}
