import { NextResponse } from "next/server";
import { getCurrentUser, isReadOnly, viewerFromUser } from "@/lib/auth-helpers";
import { eliminarVisitasSchema } from "@/lib/validations/visita";
import { softDeleteVisitas } from "@/lib/services/visita.service";
import {
  ServiceError,
  httpStatusForServiceError,
} from "@/lib/services/errors";

const viewerFromSession = viewerFromUser;

/**
 * POST y no DELETE: manda un cuerpo con los ids, y un DELETE con cuerpo lo
 * descartan proxies y clientes sin avisar.
 *
 * Responde 200 aunque alguna no se haya podido eliminar: el lote no es una sola
 * operación —cada visita se revisa sola— y la pantalla necesita saber cuáles
 * salieron y por qué se quedaron las otras, no un error suelto.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = eliminarVisitasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const resultado = await softDeleteVisitas(
      parsed.data.ids,
      viewerFromSession(user)
    );
    return NextResponse.json(resultado);
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
