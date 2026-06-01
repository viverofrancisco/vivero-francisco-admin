import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";

/**
 * Lightweight list of active personal for picker UIs (e.g. crear visita).
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const personal = await prisma.personal.findMany({
    where: { deletedAt: null, estado: "ACTIVO" },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      tipo: true,
    },
    orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
  });

  return NextResponse.json({ items: personal });
}
