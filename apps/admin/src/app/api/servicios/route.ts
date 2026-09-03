import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, viewerFromUser } from "@/lib/auth-helpers";
import { createServicio } from "@/lib/services/servicio.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { servicioSchema } from "@/lib/validations/servicio";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const servicios = await prisma.producto.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { suscripcionItems: true } } },
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

  // Por el servicio y no inline: ahí viven el permiso y el saneo de los campos
  // opcionales, que este create se estaba salteando.
  const data = result.data;
  try {
    const servicio = await createServicio(viewerFromUser(user), {
      nombre: data.nombre,
      descripcion: data.descripcion || null,
      tipo: data.tipo,
      ivaTasa: data.ivaTasa ?? null,
      categoriaId: data.categoriaId ?? null,
      codigo: data.codigo ?? null,
    });
    return NextResponse.json(servicio, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
