import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { clienteServicioSchema } from "@/lib/validations/cliente-servicio";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const asignaciones = await prisma.clienteServicio.findMany({
    where: { clienteId: id },
    orderBy: { createdAt: "desc" },
    include: { servicio: true },
  });

  return NextResponse.json(
    asignaciones.map((a: typeof asignaciones[number]) => ({
      ...a,
      precio: Number(a.precio),
      iva: Number(a.iva),
    }))
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: clienteId } = await params;
  const body = await request.json();
  const result = clienteServicioSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const asignacion = await prisma.clienteServicio.create({
      data: {
        clienteId,
        servicioId: data.servicioId,
        precio: data.precio,
        iva: data.iva,
        frecuenciaMensual: data.frecuenciaMensual ?? null,
        estado: data.estado,
        fechaInicio: new Date(data.fechaInicio),
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
        notas: data.notas || null,
        createdById: user.id,
        updatedById: user.id,
      },
      include: { servicio: true },
    });

    return NextResponse.json(
      { ...asignacion, precio: Number(asignacion.precio), iva: Number(asignacion.iva) },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Este servicio ya está asignado a este cliente" },
      { status: 409 }
    );
  }
}
