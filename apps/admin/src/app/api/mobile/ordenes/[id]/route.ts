import { NextResponse } from "next/server";
import { nombreCliente } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { getOrden, propiedadesDeLaOrden } from "@/lib/services/orden.service";
import { facturaVigenteDe } from "@/lib/services/factura-vigente";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Una orden: de qué es, qué se cobra y cómo viene el cobro.
 *
 * Achicada para el teléfono. Lo que no viaja es lo que allá no se puede hacer:
 * el XML de la factura, las notas de crédito, los datos de facturación. Lo que
 * sí viaja son las líneas —el detalle es la respuesta a "¿por qué este total?"—
 * y la factura viva con su saldo y sus cobros.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id } = await params;
  try {
    const orden = await getOrden(viewerFromMobileUser(userOrResponse), id);
    // La factura viva la decide `facturaVigenteDe`, no "la que no está
    // anulada": desde que las notas de crédito viven en la misma tabla, una
    // nota tampoco está anulada y no es la factura de la orden.
    const vigente = facturaVigenteDe(orden.facturas);

    return NextResponse.json({
      id: orden.id,
      numero: orden.numero,
      fecha: orden.fecha.toISOString(),
      estado: orden.estado,
      notas: orden.notas,
      cliente: {
        id: orden.cliente.id,
        nombre: nombreCliente(orden.cliente),
        telefono: orden.cliente.telefono,
        // Para proponer a dónde mandarle la factura.
        email: orden.cliente.email,
      },
      propiedades: propiedadesDeLaOrden(orden).map((p) => p.nombre),
      visitas: orden.visitas.map((v) => ({
        id: v.visita.id,
        numero: v.visita.numero,
      })),
      suscripcion: orden.suscripcion
        ? { id: orden.suscripcion.id, numero: orden.suscripcion.numero }
        : null,
      lineas: orden.lineas.map((l) => ({
        id: l.id,
        descripcion: l.descripcion,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        total: Number(l.total),
      })),
      subtotal: Number(orden.subtotal),
      iva: Number(orden.iva),
      total: Number(orden.total),
      factura: vigente
        ? {
            id: vigente.id,
            numero: vigente.numero,
            estado: vigente.estado,
            // `null` = nunca se sincronizó con el SRI: no es lo mismo que cero.
            saldo: vigente.saldo === null ? null : Number(vigente.saldo),
            fechaEmision: vigente.fechaEmision.toISOString(),
            // Si ya se le mandó al cliente: el menú dice "Volver a enviar".
            enviadoEl: vigente.enviadoEl?.toISOString() ?? null,
          }
        : null,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
