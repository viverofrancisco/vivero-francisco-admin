import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  actualizarDatoFacturacion,
  archivarDatoFacturacion,
} from "@/lib/services/dato-facturacion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { datoFacturacionSchema } from "@/lib/validations/facturacion";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = datoFacturacionSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await actualizarDatoFacturacion(viewer, id, parsed.data)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Archiva, no borra: las facturas emitidas lo siguen citando. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await archivarDatoFacturacion(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
