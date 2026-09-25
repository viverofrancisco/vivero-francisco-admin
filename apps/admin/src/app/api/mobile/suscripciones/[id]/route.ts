import { NextResponse } from "next/server";
import { actualizarSuscripcionSchema, nombreCliente } from "@vivero/shared";
import { prisma } from "@/lib/prisma";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import {
  UBICACION_DE_PROPIEDAD,
  actualizarSuscripcion,
  cambiarEstadoSuscripcion,
  getSuscripcion,
  ordenesDeSuscripcion,
  visitasDeSuscripcion,
} from "@/lib/services/suscripcion.service";
import { tareasHechas } from "@/lib/visita-tareas";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * La ficha de un plan, con todo lo que la pantalla del teléfono muestra: el
 * jardín y dónde queda, las propiedades del cliente entre las que se puede
 * mover, sus visitas y sus órdenes. Es la misma ficha que el portal en móvil.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(_request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const viewer = viewerFromMobileUser(userOrResponse);
  const { id } = await params;
  try {
    const s = await getSuscripcion(viewer, id);
    const [ordenes, visitas, propiedades] = await Promise.all([
      ordenesDeSuscripcion(viewer, id),
      visitasDeSuscripcion(viewer, id),
      prisma.propiedad.findMany({
        where: { clienteId: s.cliente.id, deletedAt: null },
        select: UBICACION_DE_PROPIEDAD,
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return NextResponse.json({
      id: s.id,
      numero: s.numero,
      estado: s.estado,
      periodicidad: s.periodicidad,
      fechaInicio: s.fechaInicio.toISOString(),
      notas: s.notas,
      precio: Number(s.precio),
      ivaTasa: Number(s.ivaTasa),
      visitasPorPeriodo: s.visitasPorPeriodo,
      cliente: { id: s.cliente.id, nombre: nombreCliente(s.cliente) },
      propiedad: s.propiedad,
      // La del plan siempre está, aunque después la hayan eliminado.
      propiedades: propiedades.some((p) => p.id === s.propiedad.id)
        ? propiedades
        : [s.propiedad, ...propiedades],
      visitas: visitas.map((v) => ({
        id: v.id,
        numero: v.numero,
        fechaProgramada: v.fechaProgramada.toISOString(),
        fechaRealizada: v.fechaRealizada?.toISOString() ?? null,
        estado: v.estado,
        tareas: tareasHechas({
          tareasObligatorias: v.tareasObligatorias,
          personal: v.personal,
        }).map((t) => t.nombre),
      })),
      ordenes: ordenes.map((o) => ({
        ...o,
        fecha: o.fecha.toISOString(),
        periodoInicio: o.periodoInicio?.toISOString() ?? null,
        periodoFin: o.periodoFin?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * Editar el plan. Mandar `{estado}` a secas pasa por `cambiarEstadoSuscripcion`,
 * que además maneja la `fechaFin` al cancelar — igual que la ruta del portal.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = actualizarSuscripcionSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const viewer = viewerFromMobileUser(userOrResponse);
  const { id } = await params;
  const { estado, ...resto } = parsed.data;
  try {
    const soloEstado =
      estado !== undefined &&
      Object.values(resto).every((v) => v === undefined);
    const s = soloEstado
      ? await cambiarEstadoSuscripcion(viewer, id, estado)
      : await actualizarSuscripcion(viewer, id, { estado, ...resto });
    return NextResponse.json({ id: s.id, numero: s.numero });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
