import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { guardarOpciones } from "@/lib/services/variante.service";
import { opcionesSchema } from "@/lib/validations/producto";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * La gemela de `PUT /api/servicios/[id]/opciones`: reemplaza los ejes del
 * producto y regenera sus variantes, por el mismo servicio y con el mismo
 * schema. Es un reemplazo entero, no un parche, y puede responder 409 cuando
 * el cambio borra variantes con stock: la app pregunta y vuelve a mandar con
 * `descartarVariantes`.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  const parsed = opcionesSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const variantes = await guardarOpciones(
      viewerFromMobileUser(userOrResponse),
      id,
      parsed.data.opciones,
      { descartarVariantes: parsed.data.descartarVariantes }
    );
    return NextResponse.json({ variantes, total: variantes.length });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
