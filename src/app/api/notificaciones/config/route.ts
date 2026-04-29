import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { notificacionConfigSchema } from "@/lib/validations/notificacion";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const config = await prisma.notificacionConfig.findFirst();
  if (!config) {
    return NextResponse.json(
      { error: "Configuración no encontrada. Ejecuta el seed script." },
      { status: 404 }
    );
  }

  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = notificacionConfigSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const config = await prisma.notificacionConfig.findFirst();
  if (!config) {
    return NextResponse.json(
      { error: "Configuración no encontrada. Ejecuta el seed script." },
      { status: 404 }
    );
  }

  const updated = await prisma.notificacionConfig.update({
    where: { id: config.id },
    data: result.data,
  });

  return NextResponse.json(updated);
}
