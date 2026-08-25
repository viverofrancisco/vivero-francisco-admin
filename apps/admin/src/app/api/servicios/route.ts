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

  // Por el servicio y no inline: ahí viven el IVA, el vínculo con Contífico y el
  // vínculo con Contífico, que este create se estaba salteando.
  const data = result.data;
  try {
    const servicio = await createServicio(viewerFromUser(user), {
      nombre: data.nombre,
      descripcion: data.descripcion || null,
      tipo: data.tipo,
      ivaTasa: data.ivaTasa ?? null,
      contificoProductoId: data.contificoProductoId ?? null,
      codigo: data.codigo ?? null,
      actualizarNombre: data.actualizarNombre,
      crearEnContifico: data.crearEnContifico,
    });
    return NextResponse.json(servicio, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
