import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * Qué propiedades están en un sector.
 *
 * Era `/clientes`: el sector agrupaba personas. Ahora agrupa lugares, porque el
 * sector es geográfico y alguien con casa en Isla Mocolí y oficina en Vía a la
 * Costa está en dos —con el sector en el cliente había que elegir uno y el otro
 * quedaba mal contado—.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const { propiedadIds } = (await request.json()) as {
    propiedadIds?: string[];
  };

  if (!Array.isArray(propiedadIds) || propiedadIds.length === 0) {
    return NextResponse.json(
      { error: "Debes seleccionar al menos una propiedad" },
      { status: 400 }
    );
  }

  const sector = await prisma.sector.findUnique({ where: { id } });
  if (!sector) {
    return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 });
  }

  await prisma.propiedad.updateMany({
    where: { id: { in: propiedadIds }, deletedAt: null },
    data: { sectorId: id, updatedById: user.id },
  });

  return NextResponse.json({ message: "Propiedades asignadas" });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const { propiedadId, propiedadIds } = (await request.json()) as {
    propiedadId?: string;
    propiedadIds?: string[];
  };
  const ids = propiedadIds ?? (propiedadId ? [propiedadId] : []);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Debes indicar al menos una propiedad" },
      { status: 400 }
    );
  }

  // Acotado al sector: si un id no es de acá, no se toca. Así un id viejo o
  // equivocado no puede sacarle el sector a una propiedad de otro lado.
  const { count } = await prisma.propiedad.updateMany({
    where: { id: { in: ids }, sectorId: id },
    data: { sectorId: null, updatedById: user.id },
  });

  return NextResponse.json({
    message: `${count} propiedad(es) removidas del sector`,
  });
}
