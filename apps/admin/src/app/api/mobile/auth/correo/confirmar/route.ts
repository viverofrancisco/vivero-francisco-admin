import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { confirmarCambioDeCorreo } from "@/lib/services/cambio-de-correo.service";

const cuerpo = z.object({
  codigo: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos"),
});

/** Cambiar el correo, segundo paso: el código. Devuelve el correo nuevo. */
export async function POST(request: Request) {
  const user = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(user)) return user;
  if (!user.clienteId) {
    return NextResponse.json({ error: "Sin cliente" }, { status: 403 });
  }

  const parsed = cuerpo.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const email = await confirmarCambioDeCorreo(user.id, user.clienteId, parsed.data.codigo);
    return NextResponse.json({ email });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
