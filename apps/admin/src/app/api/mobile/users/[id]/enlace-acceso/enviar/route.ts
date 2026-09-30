import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { enviarEnlacePorCorreo } from "@/lib/services/acceso.service";

const bodySchema = z.object({
  enlace: z.string().min(10),
  tipo: z.enum(["invitacion", "restablecer"]),
});

/** Gemela de `POST /api/users/[id]/enlace-acceso/enviar`: manda ese enlace, no otro. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    return NextResponse.json(
      await enviarEnlacePorCorreo(id, parsed.data.enlace, parsed.data.tipo)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
