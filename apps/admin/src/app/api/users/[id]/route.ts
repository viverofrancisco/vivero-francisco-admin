import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser, viewerFromUser } from "@/lib/auth-helpers";
import {
  actualizarUsuarioDelEquipo,
  getUsuarioDelEquipo,
} from "@/lib/services/usuario.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

// Sin `password`: nadie le pone la contraseña a nadie. Para eso está
// `POST /api/users/[id]/enlace-acceso`, que emite un enlace de un solo uso y
// deja que la elija su dueño.
const updateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").optional(),
  apellido: z.string().optional(),
  email: z.email("Correo inválido").optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(await getUsuarioDelEquipo(viewerFromUser(user), id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const result = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await actualizarUsuarioDelEquipo(viewerFromUser(user), id, result.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
