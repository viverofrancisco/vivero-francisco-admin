import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";

/**
 * Lightweight list of active grupos for picker UIs (e.g. crear visita).
 * Each grupo includes its miembros so the form can auto-fill personal
 * selection when a grupo is chosen.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const grupos = await prisma.grupo.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      nombre: true,
      miembros: { select: { personalId: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json({
    items: grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      miembrosIds: g.miembros.map((m) => m.personalId),
    })),
  });
}
