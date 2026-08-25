import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  actualizarSuscripcion,
  cambiarEstadoSuscripcion,
  getSuscripcion,
} from "@/lib/services/suscripcion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { actualizarSuscripcionSchema } from "@/lib/validations/suscripcion";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    return NextResponse.json(await getSuscripcion(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * Cambiar solo el estado no toca los ítems: mandar `{estado}` a secas pasa por
 * `cambiarEstadoSuscripcion`, que además maneja la `fechaFin` al cancelar.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = actualizarSuscripcionSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { estado, items, periodicidad, fechaInicio, notas } = parsed.data;
  try {
    const soloEstado =
      estado !== undefined &&
      items === undefined &&
      periodicidad === undefined &&
      fechaInicio === undefined &&
      notas === undefined;
    if (soloEstado) {
      return NextResponse.json(
        await cambiarEstadoSuscripcion(viewer, id, estado)
      );
    }
    return NextResponse.json(
      await actualizarSuscripcion(viewer, id, {
        periodicidad,
        estado,
        fechaInicio,
        notas,
        items: items?.map((i) => ({
          productoId: i.productoId,
          precio: i.precio,
          ivaTasa: i.ivaTasa ?? null,
          visitasPorPeriodo: i.visitasPorPeriodo ?? null,
        })),
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
