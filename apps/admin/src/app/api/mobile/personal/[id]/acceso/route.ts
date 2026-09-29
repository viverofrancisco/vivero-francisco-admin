import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { setAccesoPersonal } from "@/lib/services/personal-acceso.service";

const bodySchema = z.object({ revocado: z.boolean() });

/**
 * Corta o devuelve el acceso de alguien del campo desde la app. Gemela de
 * `POST /api/personal/[id]/acceso`: no borra la cuenta, su nombre sigue
 * firmando los partes que cargó.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { id } = await params;
  try {
    return NextResponse.json({ estado: await setAccesoPersonal(id, parsed.data.revocado) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
