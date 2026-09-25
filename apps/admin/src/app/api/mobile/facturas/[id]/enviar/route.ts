import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { getOrden } from "@/lib/services/orden.service";
import { NotFoundError } from "@/lib/services/errors";
import { enviarFacturaAlCliente } from "@/lib/sri/envio";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

const cuerpo = z.object({
  /** A dónde mandarla. Sin esto, al correo del cliente. */
  correo: z.string().email("Ese correo no es válido").nullable().optional(),
});

/** Le manda al cliente el RIDE y el XML, desde el teléfono. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
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
    await getOrden(viewerFromMobileUser(userOrResponse), factura.ordenId);
    return NextResponse.json(await enviarFacturaAlCliente(id, parsed.data.correo));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
