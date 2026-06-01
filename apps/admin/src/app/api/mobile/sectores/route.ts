import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";

/**
 * Lists sectors available to the calling user — used to populate the cliente
 * form. ADMIN/STAFF see all; PERSONAL_ADMIN only sees their assigned ones.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(
    request,
    "ADMIN",
    "STAFF",
    "PERSONAL_ADMIN"
  );
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  if (userOrResponse.role === "PERSONAL_ADMIN") {
    const assignments = await prisma.sectorAdmin.findMany({
      where: { userId: userOrResponse.id },
      select: {
        sector: { select: { id: true, nombre: true } },
      },
      orderBy: { sector: { nombre: "asc" } },
    });
    return NextResponse.json({
      items: assignments
        .map((a) => a.sector)
        .filter((s): s is { id: string; nombre: string } => s !== null),
    });
  }

  const sectores = await prisma.sector.findMany({
    where: { deletedAt: null },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ items: sectores });
}
