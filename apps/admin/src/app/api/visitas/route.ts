import { NextResponse } from "next/server";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { crearVisitasSchema } from "@/lib/validations/visita";
import {
  createVisitasBatch,
  listVisitas,
} from "@/lib/services/visita.service";
import {
  ServiceError,
  httpStatusForServiceError,
} from "@/lib/services/errors";
import type { Viewer } from "@/lib/services/viewer";
import type { EstadoVisita } from "@/generated/prisma/client";

function viewerFromSession(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): Viewer {
  return {
    id: user.id,
    role: user.role,
    personalId: user.personalId ?? null,
    clienteId: null,
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const estado = searchParams.get("estado") as EstadoVisita | null;
  const clienteId = searchParams.get("clienteId");
  const productoId = searchParams.get("productoId");

  try {
    const result = await listVisitas(viewerFromSession(user), {
      from: desde ? new Date(desde) : undefined,
      to: hasta ? new Date(hasta) : undefined,
      estado: estado ?? undefined,
      clienteId: clienteId ?? undefined,
      productoId: productoId ?? undefined,
      limit: 200,
    });
    return NextResponse.json(result.items);
  } catch (error) {
    return handleServiceError(error);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = crearVisitasSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  try {
    const visitas = await createVisitasBatch(viewerFromSession(user), {
      clienteId: result.data.clienteId,
      productos: result.data.productos,
      fechas: result.data.fechas.map((f) => new Date(f)),
      grupoId: result.data.grupoId || null,
      notas: result.data.notas || null,
      personalIds: result.data.personalIds,
    });
    return NextResponse.json(visitas, { status: 201 });
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
