import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { visitaSchema } from "@/lib/validations/visita";
import { z } from "zod/v4";
import {
  softDeleteVisita,
  updateVisitaInfo,
  updateVisitaPersonal,
} from "@/lib/services/visita.service";
import {
  ServiceError,
  httpStatusForServiceError,
} from "@/lib/services/errors";
import type { Viewer } from "@/lib/services/viewer";

const updatePersonalSchema = z.object({
  personalIds: z.array(z.string()),
});

function viewerFromSession(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): Viewer {
  return {
    id: user.id,
    role: user.role,
    personalId: user.personalId ?? null,
    clienteId: null,
  };
}

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
  const viewer = viewerFromSession(user);

  const personalResult = updatePersonalSchema.safeParse(body);
  if (personalResult.success) {
    try {
      await updateVisitaPersonal(id, viewer, personalResult.data.personalIds);
      return NextResponse.json({ success: true });
    } catch (error) {
      return handleServiceError(error);
    }
  }

  const generalResult = visitaSchema.safeParse(body);
  if (!generalResult.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: generalResult.error.issues },
      { status: 400 }
    );
  }

  try {
    const visita = await updateVisitaInfo(id, viewer, {
      grupoId: generalResult.data.grupoId || null,
      notas: generalResult.data.notas || null,
    });
    return NextResponse.json(visita);
  } catch (error) {
    return handleServiceError(error);
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
    await softDeleteVisita(id, viewerFromSession(user));
    return NextResponse.json({ message: "Visita archivada" });
  } catch (error) {
    return handleServiceError(error);
  }
}

function handleServiceError(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: httpStatusForServiceError(error) }
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
