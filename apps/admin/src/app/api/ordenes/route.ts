import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  crearOrden,
  generarOrden,
  listarOrdenes,
} from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import {
  crearOrdenSchema,
  generarOrdenSchema,
  ordenesQuerySchema,
} from "@/lib/validations/orden";

export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const { searchParams } = new URL(request.url);
  const parsed = ordenesQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json(await listarOrdenes(viewer, parsed.data));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/**
 * Dos formas de crear una orden, según lo que venga en el cuerpo:
 *
 * - con `lineas` → el editor: las líneas las arma quien vende;
 * - con `desde`/`hasta` → barrido: junta todo lo pendiente del rango.
 */
export async function POST(request: Request) {
  const viewer = await viewerFromSession();
  const body = await request.json().catch(() => ({}));

  if (Array.isArray((body as { lineas?: unknown }).lineas)) {
    const parsed = crearOrdenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Datos inválidos",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }
    try {
      const orden = await crearOrden(viewer, {
        clienteId: parsed.data.clienteId,
        datoFacturacionId: parsed.data.datoFacturacionId ?? null,
        fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : undefined,
        notas: parsed.data.notas || null,
        lineas: parsed.data.lineas.map((l) => ({
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          ivaTasa: l.ivaTasa,
          productoId: l.productoId,
          visitaProductoIds: l.visitaProductoIds ?? [],
          suscripcionItemId: l.suscripcionItemId ?? null,
          periodoInicio: l.periodoInicio ? new Date(l.periodoInicio) : null,
          periodoFin: l.periodoFin ? new Date(l.periodoFin) : null,
        })),
      });
      return NextResponse.json(orden, { status: 201 });
    } catch (error) {
      return serviceErrorResponse(error);
    }
  }

  const parsed = generarOrdenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    // Devuelve **varias**: una por suscripción y otra con las visitas sueltas,
    // porque una orden no puede mezclar los dos orígenes.
    const ordenes = await generarOrden(viewer, {
      clienteId: parsed.data.clienteId,
      desde: new Date(parsed.data.desde),
      hasta: new Date(parsed.data.hasta),
      fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : undefined,
      notas: parsed.data.notas || null,
    });
    return NextResponse.json({ ordenes }, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
