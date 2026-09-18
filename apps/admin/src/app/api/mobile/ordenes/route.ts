import { NextResponse } from "next/server";
import { nombreCliente, propiedadesDeVisitas } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { listarOrdenes } from "@/lib/services/orden.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Las órdenes, para mirarlas desde el teléfono.
 *
 * La plata es de la oficina y eso lo hace cumplir el servicio
 * (`ensureCanRead`); el rol acá es el portero de la ruta.
 *
 * La respuesta manda el **saldo** de la factura viva y no un "cobrado sí/no":
 * si entró la plata es otro eje que el estado de la orden, y la regla de cómo
 * se lee ese saldo vive en `@vivero/shared` para que la app y el portal no la
 * redondeen distinto.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const url = new URL(request.url);
  const estados = url.searchParams.get("estados");

  try {
    const { items, total } = await listarOrdenes(
      viewerFromMobileUser(userOrResponse),
      {
        limit: Number(url.searchParams.get("limit") ?? 50) || 50,
        offset: Number(url.searchParams.get("offset") ?? 0) || 0,
        clienteId: url.searchParams.get("clienteId") ?? undefined,
        estados: estados ? estados.split(",") : ["CONFIRMADA", "ANULADA"],
      }
    );

    return NextResponse.json({
      total,
      items: items.map((o) => ({
        id: o.id,
        numero: o.numero,
        fecha: o.fecha.toISOString(),
        estado: o.estado,
        cliente: nombreCliente(o.cliente),
        clienteId: o.cliente.id,
        propiedades: propiedadesDeVisitas(o.visitas.map((v) => v.visita)).map(
          (p) => p.nombre
        ),
        lineas: o._count.lineas,
        total: Number(o.total),
        saldo:
          o.facturas[0]?.saldo === undefined || o.facturas[0]?.saldo === null
            ? null
            : Number(o.facturas[0].saldo),
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
