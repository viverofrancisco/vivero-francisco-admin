import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getOrden } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { NotFoundError } from "@/lib/services/errors";
import { enviarFacturaAlCliente } from "@/lib/sri/envio";

const cuerpo = z.object({
  /** A dónde mandarla. Sin esto, al correo del cliente. */
  correo: z.string().email("Ese correo no es válido").nullable().optional(),
});

/** Le manda al cliente el RIDE y el XML de una factura propia autorizada. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;

  const parsed = cuerpo.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const factura = await prisma.factura.findUnique({
      where: { id },
      select: { ordenId: true },
    });
    if (!factura) throw new NotFoundError("Factura no encontrada");
    await getOrden(viewer, factura.ordenId);

    return NextResponse.json(
      await enviarFacturaAlCliente(id, parsed.data.correo)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
