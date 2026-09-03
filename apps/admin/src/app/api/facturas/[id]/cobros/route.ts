import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { cobrosPropios } from "@/lib/services/cobro.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Los cobros de una factura, con lo que falta cobrar. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    const [cobros, datos] = await Promise.all([
      cobrosPropios(viewer, id),
      prisma.factura.findUniqueOrThrow({
        where: { id },
        select: { total: true, saldo: true },
      }),
    ]);
    return NextResponse.json({
      total: Number(datos.total),
      saldo: datos.saldo != null ? Number(datos.saldo) : null,
      cobros: cobros.map((c) => ({
        id: c.id,
        fecha: c.fecha.toISOString().slice(0, 10),
        monto: Number(c.monto),
        formaPago: c.formaPago,
        referencia: c.referencia,
        nota: c.nota,
        registradoPor: c.createdByNombre,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
