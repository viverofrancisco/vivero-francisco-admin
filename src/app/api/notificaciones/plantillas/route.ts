import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const plantillas = await prisma.notificacionPlantilla.findMany({
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(plantillas);
}
