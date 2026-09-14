import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";

/**
 * Los sectores, para el formulario de cliente. Los sectores agrupan clientes y
 * los ve la oficina; tenían además administradores, que se fueron con el rol
 * que acotaban.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const sectores = await prisma.sector.findMany({
    where: { deletedAt: null },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ items: sectores });
}
