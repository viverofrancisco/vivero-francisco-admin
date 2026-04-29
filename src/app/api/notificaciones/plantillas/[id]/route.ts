import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { plantillaUpdateSchema } from "@/lib/validations/notificacion";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const result = plantillaUpdateSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const plantilla = await prisma.notificacionPlantilla.findUnique({
    where: { id },
  });

  if (!plantilla) {
    return NextResponse.json(
      { error: "Plantilla no encontrada" },
      { status: 404 }
    );
  }

  const { target, contenido, ...rest } = result.data;

  // Route contenido to the correct column (contenido or contenidoEnRevision)
  const data: Record<string, unknown> = { ...rest };

  if (contenido !== undefined) {
    if (target === "contenidoEnRevision") {
      data.contenidoEnRevision = contenido;
    } else {
      data.contenido = contenido;
    }
  }

  const updated = await prisma.notificacionPlantilla.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
