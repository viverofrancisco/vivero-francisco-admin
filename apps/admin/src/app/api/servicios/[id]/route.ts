import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, viewerFromUser } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { updateServicio } from "@/lib/services/servicio.service";
import { servicioSchema } from "@/lib/validations/servicio";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const servicio = await prisma.producto.findUnique({ where: { id, deletedAt: null } });

  if (!servicio) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }

  return NextResponse.json(servicio);
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
  const result = servicioSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  // Por el servicio y no con un `update` inline: acá vive la regla de que
  // `tipo` no se cambia después de crear —suscripciones, visitas y líneas de
  // orden quedarían con una semántica que ya no corresponde, y allá el producto
  // ya está creado como SER o PRO—. El update inline la salteaba.
  try {
    return NextResponse.json(
      await updateServicio(id, viewerFromUser(user), {
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        tipo: data.tipo,
        categoriaId: data.categoriaId ?? null,
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
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

  const asignaciones = await prisma.suscripcionItem.count({
    where: { productoId: id },
  });

  if (asignaciones > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar un servicio asignado a clientes" },
      { status: 409 }
    );
  }

  try {
    await prisma.producto.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Servicio archivado" });
  } catch {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
}
