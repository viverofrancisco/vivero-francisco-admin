import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  deleteTipoActividad,
  updateTipoActividad,
} from "@/lib/services/tipo-actividad.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const updateSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  descripcionTemplate: z.string().max(2000).optional().nullable(),
  orden: z.number().int().optional(),
  activo: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const item = await updateTipoActividad(viewer, id, parsed.data);
    return NextResponse.json(item);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    await deleteTipoActividad(viewer, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
