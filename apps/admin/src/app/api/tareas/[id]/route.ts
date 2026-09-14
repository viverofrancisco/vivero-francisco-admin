import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { softDeleteTarea, updateTarea } from "@/lib/services/tarea.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

const updateSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  descripcion: z.string().max(2000).nullable().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    const item = await updateTarea(viewer, id, parsed.data);
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
    await softDeleteTarea(viewer, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
