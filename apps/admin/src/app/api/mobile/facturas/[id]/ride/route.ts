import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { getOrden } from "@/lib/services/orden.service";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import { datosDelRide } from "@/lib/sri/ride-datos";
import { renderRide } from "@/lib/sri/ride";
import { BUCKET_NAME, publicUrlForKey, s3 } from "@/lib/s3";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * El RIDE para el teléfono: se arma y se deja en R2, y se devuelve su URL.
 *
 * El portal lo sirve inline con la sesión del navegador; la app no puede
 * abrir un PDF autenticado en el visor del sistema, porque ese visor no manda
 * el token. Así que el PDF va al lado del XML (`facturas/<clave>.pdf`), con la
 * clave de acceso —49 dígitos— como nombre, igual que los informes tienen su
 * PDF público. Se vuelve a armar en cada pedido: es barato y así refleja lo
 * guardado hoy.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  try {
    const factura = await prisma.factura.findUnique({
      where: { id },
      select: { ordenId: true, claveAcceso: true },
    });
    if (!factura) throw new NotFoundError("Factura no encontrada");
    await getOrden(viewerFromMobileUser(userOrResponse), factura.ordenId);
    if (!factura.claveAcceso) {
      throw new ValidationError("Esta factura no la emitió el portal: no tiene RIDE.");
    }

    const pdf = await renderRide(await datosDelRide(id));
    const key = `facturas/${factura.claveAcceso}.pdf`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: new Uint8Array(pdf),
        ContentType: "application/pdf",
      })
    );
    return NextResponse.json({ url: publicUrlForKey(key) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
