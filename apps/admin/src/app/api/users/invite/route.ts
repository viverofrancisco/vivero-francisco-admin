import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser, viewerFromUser } from "@/lib/auth-helpers";
import { crearUsuarioDelEquipo } from "@/lib/services/usuario.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Crea una cuenta del equipo **sin contraseña** y devuelve su enlace de
 * invitación para copiarlo o compartirlo; el correo es un botón aparte. El
 * cuerpo vive en `crearUsuarioDelEquipo`, que también usa la app.
 */
const inviteSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().optional(),
  email: z.email("Correo inválido"),
  role: z.enum(["STAFF"]).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const result = inviteSchema.safeParse(await request.json().catch(() => ({})));
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const r = await crearUsuarioDelEquipo(viewerFromUser(user), result.data);
    return NextResponse.json(
      {
        ...r.usuario,
        enlace: r.enlace,
        expiraEl: r.expiraEl,
        correoEnviado: r.correoEnviado,
        correoIntentado: r.correoIntentado,
      },
      { status: 201 }
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
