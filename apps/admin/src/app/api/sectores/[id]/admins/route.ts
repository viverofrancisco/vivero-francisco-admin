import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!targetUser || targetUser.role !== "PERSONAL_ADMIN") {
    return NextResponse.json(
      { error: "El usuario debe tener rol PERSONAL_ADMIN" },
      { status: 400 }
    );
  }

  try {
    const assignment = await prisma.sectorAdmin.create({
      data: { sectorId: id, userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ya está asignado a este sector" },
      { status: 409 }
    );
  }
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
  const { userId } = await request.json();

  try {
    await prisma.sectorAdmin.delete({
      where: { sectorId_userId: { sectorId: id, userId } },
    });
    return NextResponse.json({ message: "Asignación eliminada" });
  } catch {
    return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
  }
}
