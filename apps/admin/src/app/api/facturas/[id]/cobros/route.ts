import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listarCobros } from "@/lib/services/factura.service";
import { cobrosPropios } from "@/lib/services/cobro.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    // De una factura propia los cobros son nuestros; de una de Contífico, de
    // ellos. La forma que sale es la misma para que la pantalla no se entere.
    const factura = await prisma.factura.findUnique({
      where: { id },
      select: { claveAcceso: true },
    });
    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }
    if (factura.claveAcceso) {
      // La misma forma que la de Contífico, para que la pantalla no se entere
      // de quién los lleva.
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
          formaCobro: c.formaPago,
          referencia: c.referencia,
          nota: c.nota,
          registradoPor: c.createdByNombre,
          // Los propios se pueden borrar; los de Contífico no: su API no
          // expone forma de hacerlo.
          borrable: true,
          comprobante: null,
          numeroCheque: null,
          fechaCheque: null,
          cuentaBancaria: null,
          tipoPing: null,
          numeroTarjeta: null,
          lote: null,
        })),
      });
    }
    return NextResponse.json(await listarCobros(viewer, id));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
