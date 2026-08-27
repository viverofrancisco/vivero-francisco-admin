import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

// Assign clients to a sector
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { clienteIds } = body as { clienteIds: string[] };

  if (!Array.isArray(clienteIds) || clienteIds.length === 0) {
    return NextResponse.json(
      { error: "Debes seleccionar al menos un cliente" },
      { status: 400 }
    );
  }

  const sector = await prisma.sector.findUnique({ where: { id } });
  if (!sector) {
    return NextResponse.json({ error: "Sector no encontrado" }, { status: 404 });
  }

  await prisma.cliente.updateMany({
    where: { id: { in: clienteIds } },
    data: { sectorId: id },
  });

  return NextResponse.json({ message: "Clientes asignados" });
}

// Remove a client from the sector (set sectorId to null)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  // Acepta uno o varios: quitar de a uno y quitar los tildados son el mismo
  // gesto y no merecen dos rutas.
  const { clienteId, clienteIds } = body as {
    clienteId?: string;
    clienteIds?: string[];
  };
  const ids = clienteIds ?? (clienteId ? [clienteId] : []);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Debes indicar al menos un cliente" },
      { status: 400 }
    );
  }

  // Acotado al sector: si un id no es de acá, no se toca. Así un id viejo o
  // equivocado no puede sacarle el sector a un cliente de otro lado.
  const { count } = await prisma.cliente.updateMany({
    where: { id: { in: ids }, sectorId: id },
    data: { sectorId: null },
  });

  return NextResponse.json({ message: `${count} cliente(s) removidos del sector` });
}
