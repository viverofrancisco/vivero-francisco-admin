import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { grupoSchema } from "@/lib/validations/grupo";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const grupo = await prisma.grupo.findUnique({
    where: { id, deletedAt: null },
    include: {
      miembros: {
        include: {
          personal: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  if (!grupo) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(grupo);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const result = grupoSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  try {
    const grupo = await prisma.$transaction(async (tx) => {
      await tx.grupo.update({
        where: { id },
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          updatedById: user.id,
        },
      });

      // Reemplazar miembros
      await tx.grupoMiembro.deleteMany({ where: { grupoId: id } });

      if (data.miembrosIds.length > 0) {
        await tx.grupoMiembro.createMany({
          data: data.miembrosIds.map((personalId) => ({
            personalId,
            grupoId: id,
          })),
        });
      }

      return tx.grupo.findUnique({
        where: { id },
        include: {
          miembros: {
            include: {
              personal: { select: { id: true, nombre: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(grupo);
  } catch {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
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

  const { id } = await params;

  try {
    await prisma.grupo.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Grupo archivado" });
  } catch {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }
}
