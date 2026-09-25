import { NextResponse } from "next/server";
import { nombreCliente, propiedadesDeVisitas } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { crearOrden, listarOrdenes } from "@/lib/services/orden.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { crearOrdenSchema } from "@/lib/validations/orden";

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
  // Los dos **los resuelve la base**: la lista viene de a páginas, así que
  // filtrar en el teléfono sería filtrar adentro de lo que ya se ve.
  const q = url.searchParams.get("q") ?? undefined;
  const cobro = url.searchParams.get("cobro") ?? undefined;

  try {
    const { items, total } = await listarOrdenes(
      viewerFromMobileUser(userOrResponse),
      {
        limit: Number(url.searchParams.get("limit") ?? 50) || 50,
        offset: Number(url.searchParams.get("offset") ?? 0) || 0,
        clienteId: url.searchParams.get("clienteId") ?? undefined,
        q,
        cobro: cobro as
          | "SIN_COBRAR"
          | "PARCIAL"
          | "COBRADO"
          | "ANULADA"
          | undefined,
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

/**
 * Armar una orden desde el teléfono: el mismo `crearOrden` que el portal, con
 * las mismas reglas (líneas con producto o período de plan, visitas del
 * cliente, nunca plan y visitas a la vez). Nace en BORRADOR, como allá.
 */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = crearOrdenSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const orden = await crearOrden(viewerFromMobileUser(userOrResponse), {
      clienteId: parsed.data.clienteId,
      datoFacturacionId: parsed.data.datoFacturacionId ?? null,
      fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : undefined,
      notas: parsed.data.notas || null,
      visitaIds: parsed.data.visitaIds ?? [],
      lineas: parsed.data.lineas.map((l) => ({
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        ivaTasa: l.ivaTasa,
        productoId: l.productoId ?? null,
        varianteId: l.varianteId ?? null,
        suscripcionId: l.suscripcionId ?? null,
        periodoInicio: l.periodoInicio ? new Date(l.periodoInicio) : null,
        periodoFin: l.periodoFin ? new Date(l.periodoFin) : null,
      })),
    });
    return NextResponse.json({ id: orden.id, numero: orden.numero }, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
