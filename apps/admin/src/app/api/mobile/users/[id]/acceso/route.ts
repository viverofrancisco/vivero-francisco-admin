import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import { cambiarAccesoUsuario } from "@/lib/services/usuario.service";

const bodySchema = z.object({ revocado: z.boolean() });

/** Gemela de `POST /api/users/[id]/acceso`. */
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
      await cambiarAccesoUsuario(viewerFromMobileUser(u), id, parsed.data.revocado)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
