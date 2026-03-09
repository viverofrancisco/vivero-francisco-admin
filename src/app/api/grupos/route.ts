import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { grupoSchema } from "@/lib/validations/grupo";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const grupos = await prisma.grupoJardinero.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      miembros: {
        include: {
          jardinero: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  return NextResponse.json(grupos);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const result = grupoSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  const grupo = await prisma.$transaction(async (tx) => {
    const created = await tx.grupoJardinero.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    if (data.miembrosIds.length > 0) {
      await tx.grupoJardineroMiembro.createMany({
        data: data.miembrosIds.map((jardineroId) => ({
          jardineroId,
          grupoId: created.id,
        })),
      });
    }

    return tx.grupoJardinero.findUnique({
      where: { id: created.id },
      include: {
        miembros: {
          include: {
            jardinero: { select: { id: true, nombre: true } },
          },
        },
      },
    });
  });

  return NextResponse.json(grupo, { status: 201 });
}
