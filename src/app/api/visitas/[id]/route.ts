import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { visitaSchema } from "@/lib/validations/visita";
import { z } from "zod/v4";

const updatePersonalSchema = z.object({
  personalIds: z.array(z.string()),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const visita = await prisma.visita.findUnique({
    where: { id, deletedAt: null },
    include: {
      clienteServicio: {
        include: {
          cliente: { select: { id: true, nombre: true, apellido: true, ciudad: true, sector: true } },
          servicio: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      grupo: {
        select: {
          id: true,
          nombre: true,
          miembros: {
            include: { personal: { select: { id: true, nombre: true } } },
          },
        },
      },
      personal: {
        where: { removedAt: null },
        include: { personal: { select: { id: true, nombre: true, apellido: true } } },
      },
      media: {
        select: { id: true, url: true, tipo: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  });

  if (!visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  return NextResponse.json(visita);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // Check if this is a personal update or a general update
  const personalResult = updatePersonalSchema.safeParse(body);

  if (personalResult.success) {
    // Personal update
    const visita = await prisma.visita.findUnique({ where: { id } });
    if (!visita) {
      return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
    }
    if (visita.estado !== "PROGRAMADA") {
      return NextResponse.json(
        { error: "Solo se puede modificar el personal de visitas programadas" },
        { status: 400 }
      );
    }

    const newIds = new Set(personalResult.data.personalIds);

    // Get current active personal
    const currentPersonal = await prisma.visitaPersonal.findMany({
      where: { visitaId: id, removedAt: null },
    });
    const currentIds = new Set(currentPersonal.map((p) => p.personalId));

    const toRemove = currentPersonal.filter((p) => !newIds.has(p.personalId));
    const toAdd = [...newIds].filter((pid) => !currentIds.has(pid));

    await prisma.$transaction([
      // Mark removed
      ...toRemove.map((p) =>
        prisma.visitaPersonal.update({
          where: { id: p.id },
          data: { removedAt: new Date(), removedById: user.id },
        })
      ),
      // Add new
      ...toAdd.map((pid) =>
        prisma.visitaPersonal.create({
          data: { visitaId: id, personalId: pid, addedById: user.id },
        })
      ),
      prisma.visita.update({
        where: { id },
        data: { updatedById: user.id },
      }),
    ]);

    return NextResponse.json({ success: true });
  }

  // General update (grupo, notas)
  const result = visitaSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const visita = await prisma.visita.update({
      where: { id },
      data: {
        grupoId: data.grupoId || null,
        notas: data.notas || null,
        updatedById: user.id,
      },
    });
    return NextResponse.json(visita);
  } catch {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.visita.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Visita archivada" });
  } catch {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }
}
