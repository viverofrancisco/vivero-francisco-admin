import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getOrden } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { ValidationError } from "@/lib/services/errors";
import { consultarAutorizacion } from "@/lib/sri/emision";

/**
 * Le pregunta al SRI por una factura propia que todavía no resolvió.
 *
 * El cron lo hace solo, pero cuando alguien está esperando el comprobante no
 * tiene por qué esperar la próxima corrida: el SRI suele contestar en segundos.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;

  try {
    const factura = await prisma.factura.findUnique({
      where: { id },
      select: {
        claveAcceso: true,
        emisorId: true,
        ordenId: true,
        estado: true,
      },
    });
    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }
    await getOrden(viewer, factura.ordenId);

    if (!factura.claveAcceso || !factura.emisorId) {
      throw new ValidationError(
        "Esta factura la emitió Contífico: se actualiza desde ellos."
      );
    }

    const r = await consultarAutorizacion(factura.emisorId, factura.claveAcceso);
    const estado =
      r.estado === "AUTORIZADO"
        ? "AUTORIZADO"
        : r.estado === "NO AUTORIZADO" || r.estado === "RECHAZADO"
          ? "RECHAZADO"
          : null;

    // "En proceso" no se guarda: querría decir que ya sabemos algo, y lo que
    // sabemos es que el SRI todavía no contestó.
    if (estado) {
      await prisma.$transaction(async (tx) => {
        await tx.factura.update({
          where: { id },
          data: {
            estado,
            estadoSri: r.estado,
            autorizacion: r.numeroAutorizacion ?? undefined,
            fechaAutorizacion: r.fechaAutorizacion ?? undefined,
            mensajesSri: r.mensajes?.length
              ? (JSON.parse(JSON.stringify(r.mensajes)) as object[])
              : undefined,
          },
        });
        if (estado === "AUTORIZADO") {
          await tx.orden.updateMany({
            where: { id: factura.ordenId, estado: "BORRADOR" },
            data: { estado: "CONFIRMADA" },
          });
        }
      });
    }

    return NextResponse.json({
      estado: r.estado,
      resuelta: estado !== null,
      mensajes: r.mensajes ?? [],
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
