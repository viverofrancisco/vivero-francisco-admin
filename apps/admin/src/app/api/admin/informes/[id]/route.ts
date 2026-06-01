import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  deleteInforme,
  generateInforme,
  getInforme,
} from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    const informe = await getInforme(viewer, id);
    return NextResponse.json(informe);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const updateSchema = z.object({
  clienteId: z.string().min(1),
  titulo: z.string().min(1).max(200),
  visitaIds: z.array(z.string().min(1)).min(1),
  firmantes: z
    .array(
      z.object({
        nombre: z.string().min(1).max(100),
        cedula: z.string().max(30).nullable().optional(),
      })
    )
    .min(1)
    .max(3),
  secciones: z
    .array(
      z.object({
        tipoActividadId: z.string().nullable().optional(),
        titulo: z.string().min(1).max(200),
        descripcion: z.string().max(4000).nullable().optional(),
        mediaIds: z.array(z.string().min(1)),
      })
    )
    .min(1),
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
    const result = await generateInforme(viewer, {
      ...parsed.data,
      informeId: id,
    });
    return NextResponse.json(result);
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
    await deleteInforme(viewer, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
