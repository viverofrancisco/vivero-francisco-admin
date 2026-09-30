import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import {
  actualizarUsuarioDelEquipo,
  getUsuarioDelEquipo,
} from "@/lib/services/usuario.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const { id } = await params;
  try {
    return NextResponse.json(await getUsuarioDelEquipo(viewerFromMobileUser(u), id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const editarSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").optional(),
  apellido: z.string().trim().nullable().optional(),
  email: z.email("Correo inválido").optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const parsed = editarSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await actualizarUsuarioDelEquipo(viewerFromMobileUser(u), id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
