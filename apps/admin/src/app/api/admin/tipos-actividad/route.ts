import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  createTipoActividad,
  listTiposActividad,
} from "@/lib/services/tipo-actividad.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(request: Request) {
  await viewerFromSession();
  const url = new URL(request.url);
  const incluirInactivos = url.searchParams.get("incluirInactivos") === "true";
  const items = await listTiposActividad({ incluirInactivos });
  return NextResponse.json({ items });
}

const createSchema = z.object({
  nombre: z.string().min(1).max(100),
  descripcionTemplate: z.string().max(2000).optional().nullable(),
  orden: z.number().int().optional(),
  activo: z.boolean().optional(),
});

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const item = await createTipoActividad(viewer, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
