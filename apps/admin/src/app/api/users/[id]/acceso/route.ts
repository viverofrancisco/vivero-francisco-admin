import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revocarAcceso, restaurarAcceso } from "@/lib/services/acceso.service";

const bodySchema = z.object({ revocado: z.boolean() });

/**
 * Corta o devuelve el acceso de un usuario.
 *
 * No borra la cuenta: su nombre sigue firmando lo que hizo. Ver
 * `revocarAcceso()` para qué se corta exactamente.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  if (id === actor.id) {
    // Dejarse afuera a uno mismo no tiene arreglo desde adentro.
    return NextResponse.json(
      { error: "No podés revocar tu propio acceso" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (parsed.data.revocado) {
    await revocarAcceso(user.id);
  } else {
    await restaurarAcceso(user.id);
  }
  return NextResponse.json({ ok: true });
}
