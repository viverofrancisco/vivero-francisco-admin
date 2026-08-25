import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { actualizarVisitaSchema } from "@/lib/validations/visita";
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
      cliente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          empresa: true,
          ciudad: true,
          sector: true,
        },
      },
      productos: {
        orderBy: { posicion: "asc" },
        include: {
          producto: {
                select: { id: true, nombre: true, descripcion: true, tipo: true },
          },
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

  const generalResult = actualizarVisitaSchema.safeParse(body);
  if (!generalResult.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: generalResult.error.issues },
      { status: 400 }
    );
  }

  const { personalIds } = generalResult.data;
  try {
    // Un solo parseo y las dos escrituras: antes el esquema de personal se
    // probaba primero y, como Zod ignora las claves de más, un PUT completo
    // entraba por esa rama y descartaba fecha, productos y notas en silencio.
    if (personalIds !== undefined) {
      await updateVisitaPersonal(id, viewer, personalIds);
    }

    const {
      fechaProgramada,
      fechaRealizada,
      horaEntrada,
      horaSalida,
      grupoId,
      notas,
      productoIds,
      productos,
      suscripcionId,
    } = generalResult.data;
    const soloPersonal =
      fechaProgramada === undefined &&
      fechaRealizada === undefined &&
      horaEntrada === undefined &&
      horaSalida === undefined &&
      grupoId === undefined &&
      notas === undefined &&
      productoIds === undefined &&
      productos === undefined &&
      suscripcionId === undefined;
    if (soloPersonal) return NextResponse.json({ success: true });

    const visita = await updateVisitaInfo(id, viewer, {
      // Fecha sin hora: se arma en UTC para que no se corra por zona horaria.
      ...(fechaProgramada !== undefined
        ? { fechaProgramada: new Date(`${fechaProgramada}T00:00:00.000Z`) }
        : {}),
      ...(fechaRealizada !== undefined
        ? {
            fechaRealizada: fechaRealizada
              ? new Date(`${fechaRealizada}T00:00:00.000Z`)
              : null,
          }
        : {}),
      ...(horaEntrada !== undefined ? { horaEntrada: horaEntrada || null } : {}),
      ...(horaSalida !== undefined ? { horaSalida: horaSalida || null } : {}),
      ...(grupoId !== undefined ? { grupoId: grupoId || null } : {}),
      ...(notas !== undefined ? { notas: notas || null } : {}),
      ...(productoIds !== undefined ? { productoIds } : {}),
      ...(productos !== undefined ? { productos } : {}),
      ...(suscripcionId !== undefined ? { suscripcionId } : {}),
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
