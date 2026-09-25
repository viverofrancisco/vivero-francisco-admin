import { NextResponse } from "next/server";
import { crearSuscripcionSchema, nombreCliente, totalDelPeriodo } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  crearSuscripcion,
  listarSuscripciones,
} from "@/lib/services/suscripcion.service";
import { periodosSinOrdenPorSuscripcion } from "@/lib/services/orden.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * Los planes, para el teléfono.
 *
 * Es la misma lista que el portal muestra en móvil: todas, canceladas
 * incluidas, con lo que se cobra por período y cuántos períodos vencidos
 * esperan su orden. La plata es de la oficina y eso lo hace cumplir el
 * servicio; el rol acá es el portero de la ruta. Se filtra en la app, como en
 * el portal: la lista no viene de a páginas.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const viewer = viewerFromMobileUser(userOrResponse);
  const clienteId = new URL(request.url).searchParams.get("clienteId");
  try {
    const [items, sinOrden] = await Promise.all([
      listarSuscripciones(viewer, {
        incluirCanceladas: true,
        clienteId: clienteId ?? undefined,
      }),
      periodosSinOrdenPorSuscripcion(viewer),
    ]);
    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        numero: s.numero,
        estado: s.estado,
        periodicidad: s.periodicidad,
        fechaInicio: s.fechaInicio.toISOString(),
        precio: Number(s.precio),
        ivaTasa: Number(s.ivaTasa),
        totalPeriodo: totalDelPeriodo(Number(s.precio), Number(s.ivaTasa)),
        visitasPorPeriodo: s.visitasPorPeriodo,
        cliente: { id: s.cliente.id, nombre: nombreCliente(s.cliente) },
        propiedad: { id: s.propiedad.id, nombre: s.propiedad.nombre },
        periodosPendientes: sinOrden.get(s.id)?.cantidad ?? 0,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** Armar un plan desde el teléfono: el mismo servicio y las mismas reglas que el portal. */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = crearSuscripcionSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    const s = await crearSuscripcion(viewerFromMobileUser(userOrResponse), {
      clienteId: parsed.data.clienteId,
      propiedadId: parsed.data.propiedadId,
      periodicidad: parsed.data.periodicidad,
      fechaInicio: parsed.data.fechaInicio,
      precio: parsed.data.precio,
      ivaTasa: parsed.data.ivaTasa ?? null,
      visitasPorPeriodo: parsed.data.visitasPorPeriodo,
      notas: parsed.data.notas ?? null,
    });
    return NextResponse.json({ id: s.id, numero: s.numero }, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
