import { NextResponse } from "next/server";
import { completeVisitaSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { completeVisita } from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Dar la visita por terminada. **Es de oficina**, también desde el teléfono.
 *
 * Lo que hace el jardinero es cargar su parte (`/parte`): sus horas y las
 * tareas que él hizo. Decir que el trabajo está terminado es mirar lo que
 * cargaron todos y qué falta de lo que se exigía, y eso lo decide quien lleva
 * la agenda.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = completeVisitaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const visita = await completeVisita(
      id,
      viewerFromMobileUser(userOrResponse),
      {
        notas: parsed.data.notas,
        fechaRealizada: parsed.data.fechaRealizada
          ? new Date(parsed.data.fechaRealizada)
          : undefined,
      }
    );
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
