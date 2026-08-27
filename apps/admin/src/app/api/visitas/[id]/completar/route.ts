import { NextResponse } from "next/server";
import { getCurrentUser, isReadOnly, viewerFromUser } from "@/lib/auth-helpers";
import { completarVisitaSchema } from "@/lib/validations/visita";
import {
  cancelVisita,
  completeVisita,
  markVisitaIncomplete,
} from "@/lib/services/visita.service";
import {
  ServiceError,
  httpStatusForServiceError,
} from "@/lib/services/errors";

export async function POST(
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
  const result = completarVisitaSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const viewer = viewerFromUser(user);
  const fechaRealizada = new Date(data.fechaRealizada);
  const horaEntrada = data.horaEntrada || null;
  const horaSalida = data.horaSalida || null;

  try {
    let updated;
    if (data.estado === "COMPLETADA") {
      updated = await completeVisita(id, viewer, {
        notes: data.notas || null,
        fechaRealizada,
        horaEntrada,
        horaSalida,
      });
    } else if (data.estado === "INCOMPLETA") {
      updated = await markVisitaIncomplete(id, viewer, {
        reason: data.notasIncompleto?.trim() || "",
        fechaRealizada,
        horaEntrada,
        horaSalida,
      });
    } else {
      // CANCELADA
      updated = await cancelVisita(id, viewer, {
        motivo: data.notasIncompleto || null,
        fechaRealizada,
      });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: httpStatusForServiceError(error) }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
