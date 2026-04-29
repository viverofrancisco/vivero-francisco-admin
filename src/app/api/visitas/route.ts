import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserSectorIds, isReadOnly } from "@/lib/auth-helpers";
import { crearVisitasSchema } from "@/lib/validations/visita";
import { enviarConfirmacionVisita } from "@/lib/whatsapp/service";
import { pushConfirmacionVisita } from "@/lib/push/triggers";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const estado = searchParams.get("estado");
  const clienteId = searchParams.get("clienteId");
  const servicioId = searchParams.get("servicioId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (desde || hasta) {
    where.fechaProgramada = {};
    if (desde) where.fechaProgramada.gte = new Date(desde);
    if (hasta) where.fechaProgramada.lte = new Date(hasta);
  }

  if (estado) {
    where.estado = estado;
  }

  if (clienteId) {
    where.clienteServicio = { ...where.clienteServicio, clienteId };
  }

  if (servicioId) {
    where.clienteServicio = { ...where.clienteServicio, servicioId };
  }

  // Role-based filtering
  if (user.role === "PERSONAL_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    where.clienteServicio = {
      ...where.clienteServicio,
      cliente: { sectorId: { in: sectorIds } },
    };
  } else if (user.role === "PERSONAL") {
    const personal = await prisma.personal.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (personal) {
      where.OR = [
        { grupo: { miembros: { some: { personalId: personal.id } } } },
        { personal: { some: { personalId: personal.id, removedAt: null } } },
      ];
    } else {
      return NextResponse.json([]);
    }
  }

  const visitas = await prisma.visita.findMany({
    where: { ...where, deletedAt: null },
    orderBy: { fechaProgramada: "asc" },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { id: true, nombre: true, apellido: true } },
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      grupo: { select: { id: true, nombre: true } },
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
  const result = crearVisitasSchema.safeParse(body);

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

  if (user.role === "PERSONAL_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    if (!clienteServicio.cliente.sectorId || !sectorIds.includes(clienteServicio.cliente.sectorId)) {
      return NextResponse.json({ error: "No tienes acceso a este cliente" }, { status: 403 });
    }
  }

  const fechas = data.fechas.map((f) => new Date(f));

  // Check for duplicates in batch
  const existing = await prisma.visita.findMany({
    where: {
      clienteServicioId: data.clienteServicioId,
      fechaProgramada: { in: fechas },
      estado: { not: "CANCELADA" },
      deletedAt: null,
    },
    select: { fechaProgramada: true },
  });

  if (existing.length > 0) {
    const dupes = existing.map((e) => e.fechaProgramada.toISOString().split("T")[0]);
    return NextResponse.json(
      { error: `Ya existen visitas para estas fechas: ${dupes.join(", ")}` },
      { status: 400 }
    );
  }

  const visitas = await prisma.$transaction(
    fechas.map((fecha) =>
      prisma.visita.create({
        data: {
          clienteServicioId: data.clienteServicioId,
          fechaProgramada: fecha,
          grupoId: data.grupoId || null,
          notas: data.notas || null,
          createdById: user.id,
          updatedById: user.id,
          personal: data.personalIds.length > 0
            ? {
                create: data.personalIds.map((pid) => ({
                  personalId: pid,
                  addedById: user.id,
                })),
              }
            : undefined,
        },
      })
    )
  );

  // Fire-and-forget notifications for each created visit
  for (const visita of visitas) {
    enviarConfirmacionVisita(visita.id).catch(console.error);
    pushConfirmacionVisita(visita.id).catch(console.error);
  }

  return NextResponse.json(visitas, { status: 201 });
}
