import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import {
  crearUsuarioDelEquipo,
  listUsuariosDelEquipo,
} from "@/lib/services/usuario.service";

/** Las cuentas del equipo, por la puerta de la app. Gemela de Usuarios del portal. */
export async function GET(request: Request) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  try {
    return NextResponse.json({ items: await listUsuariosDelEquipo(viewerFromMobileUser(u)) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const crearSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  apellido: z.string().trim().nullable().optional(),
  email: z.email("Correo inválido"),
});

export async function POST(request: Request) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const parsed = crearSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await crearUsuarioDelEquipo(viewerFromMobileUser(u), parsed.data),
      { status: 201 }
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
