import { NextResponse } from "next/server";
import { tareaSchema } from "@/lib/validations/tarea";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { softDeleteTarea, updateTarea } from "@/lib/services/tarea.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = tareaSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await updateTarea(viewerFromMobileUser(userOrResponse), id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * Borrar una tarea es siempre **archivarla**.
 *
 * Sigue nombrando el trabajo de cada visita donde se hizo —visitas ya impresas
 * en informes que el cliente tiene—; lo que desaparece es de los selectores.
 */
export async function DELETE(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    await softDeleteTarea(viewerFromMobileUser(userOrResponse), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
