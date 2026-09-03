import { viewerFromSession } from "@/lib/auth-helpers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrden } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { datosDelRide } from "@/lib/sri/ride-datos";
import { renderRide } from "@/lib/sri/ride";

/**
 * El RIDE de una factura emitida por el portal, en PDF.
 *
 * Se arma en el momento y no se guarda: sale entero de lo que está en la base
 * —la factura guarda sus líneas y su snapshot— así que dos llamadas dan el
 * mismo papel, y guardarlo sería una copia más que mantener. El que **sí** hay
 * que conservar es el XML autorizado, que es el documento legal.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;

  try {
    const factura = await prisma.factura.findUnique({
      where: { id },
      select: { ordenId: true, numero: true },
    });
    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }
    // Valida que el viewer pueda ver esa orden, igual que el resto.
    await getOrden(viewer, factura.ordenId);

    const pdf = await renderRide(await datosDelRide(id));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="factura-${factura.numero}.pdf"`,
      },
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
