import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { actualizarOrden, getOrden } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { actualizarOrdenSchema } from "@/lib/validations/orden";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await getOrden(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Editar el borrador. El servicio rechaza cualquier otro estado. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = actualizarOrdenSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const orden = await actualizarOrden(viewer, id, {
      clienteId: parsed.data.clienteId,
      datoFacturacionId: parsed.data.datoFacturacionId,
      fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : undefined,
      notas: parsed.data.notas,
      lineas: parsed.data.lineas?.map((l) => ({
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        ivaTasa: l.ivaTasa,
        productoId: l.productoId,
        visitaProductoIds: l.visitaProductoIds ?? [],
        suscripcionItemId: l.suscripcionItemId ?? null,
        periodoInicio: l.periodoInicio ? new Date(l.periodoInicio) : null,
        periodoFin: l.periodoFin ? new Date(l.periodoFin) : null,
      })),
    });
    return NextResponse.json(orden);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
