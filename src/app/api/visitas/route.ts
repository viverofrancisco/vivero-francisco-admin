import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserSectorIds, isReadOnly } from "@/lib/auth-helpers";
import { visitaSchema } from "@/lib/validations/visita";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes");
  const anio = searchParams.get("anio");
  const estado = searchParams.get("estado");
  const clienteId = searchParams.get("clienteId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (mes && anio) {
    const mesNum = parseInt(mes);
    const anioNum = parseInt(anio);
    const inicio = new Date(anioNum, mesNum - 1, 1);
    const fin = new Date(anioNum, mesNum, 1);
    where.fechaProgramada = { gte: inicio, lt: fin };
  }

  if (estado) {
    where.estado = estado;
  }

  if (clienteId) {
    where.clienteServicio = { ...where.clienteServicio, clienteId };
  }

  // Role-based filtering
  if (user.role === "JARDINERO_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    where.clienteServicio = {
      ...where.clienteServicio,
      cliente: { sectorId: { in: sectorIds } },
    };
  } else if (user.role === "JARDINERO") {
    const jardinero = await prisma.jardinero.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (jardinero) {
      where.grupo = {
        miembros: { some: { jardineroId: jardinero.id } },
      };
    } else {
      return NextResponse.json([]);
    }
  }

  const visitas = await prisma.visita.findMany({
    where,
    orderBy: { fechaProgramada: "asc" },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { id: true, nombre: true } },
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      grupo: { select: { id: true, nombre: true } },
      visitaOrigen: { select: { id: true, fechaProgramada: true } },
    },
  });

  return NextResponse.json(visitas);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = visitaSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  const clienteServicio = await prisma.clienteServicio.findUnique({
    where: { id: data.clienteServicioId },
    include: { cliente: { select: { sectorId: true } } },
  });

  if (!clienteServicio || clienteServicio.estado !== "ACTIVO") {
    return NextResponse.json(
      { error: "El servicio asignado no existe o no está activo" },
      { status: 400 }
    );
  }

  if (user.role === "JARDINERO_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    if (!clienteServicio.cliente.sectorId || !sectorIds.includes(clienteServicio.cliente.sectorId)) {
      return NextResponse.json({ error: "No tienes acceso a este cliente" }, { status: 403 });
    }
  }

  const visita = await prisma.visita.create({
    data: {
      clienteServicioId: data.clienteServicioId,
      fechaProgramada: new Date(data.fechaProgramada),
      grupoId: data.grupoId || null,
      notas: data.notas || null,
      createdById: user.id,
      updatedById: user.id,
    },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { id: true, nombre: true } },
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      grupo: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json(visita, { status: 201 });
}
