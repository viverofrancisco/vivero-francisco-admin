import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  deleteInforme,
  editarInforme,
  getInforme,
} from "@/lib/services/informe.service";
import { informeGenerateSchema } from "@/lib/validations/informe";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Igual que generar, más la nota de qué se cambió. */
const editarSchema = informeGenerateSchema.extend({
  nota: z.string().max(500).nullable().optional(),
});

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

/**
 * Vuelve a generar el informe, guardando la versión anterior.
 *
 * El PDF que ya se entregó no se pierde: queda como versión y se puede abrir.
 * Es lo que hace que editar sea aceptable en un documento que ya salió.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = editarSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", detalles: parsed.error.issues },
      { status: 400 }
    );
  }
  const { nota, ...payload } = parsed.data;
  try {
    return NextResponse.json(await editarInforme(viewer, id, payload, nota));
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
