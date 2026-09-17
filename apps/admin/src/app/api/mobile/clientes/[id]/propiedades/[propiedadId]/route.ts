import { NextResponse } from "next/server";
import { createPropiedadSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  actualizarPropiedad,
  eliminarPropiedad,
} from "@/lib/services/propiedad.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

type Params = { params: Promise<{ id: string; propiedadId: string }> };

/**
 * Guardar una propiedad.
 *
 * Toma el esquema entero y no el parcial a propósito: el formulario manda todos
 * los campos y el servicio escribe la fila completa, así que borrar la
 * referencia es mandarla vacía. Con el parcial, un campo ausente y un campo
 * vaciado serían indistinguibles.
 */
export async function PUT(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = createPropiedadSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { id, propiedadId } = await params;
  try {
    const propiedad = await actualizarPropiedad(
      viewerFromMobileUser(userOrResponse),
      id,
      propiedadId,
      parsed.data
    );
    return NextResponse.json(propiedad);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id, propiedadId } = await params;
  try {
    // Con visitas el servicio se niega y dice cuántas: esas visitas pasaron
    // ahí, y dejarlas sin lugar es un registro que no se puede explicar.
    await eliminarPropiedad(viewerFromMobileUser(userOrResponse), id, propiedadId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
