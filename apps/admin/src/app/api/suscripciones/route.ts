import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  crearSuscripcion,
  listarSuscripciones,
} from "@/lib/services/suscripcion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import {
  crearSuscripcionSchema,
  suscripcionesQuerySchema,
} from "@/lib/validations/suscripcion";

export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const { searchParams } = new URL(request.url);
  const parsed = suscripcionesQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      items: await listarSuscripciones(viewer, parsed.data),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const viewer = await viewerFromSession();
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
    const suscripcion = await crearSuscripcion(viewer, {
      clienteId: parsed.data.clienteId,
      periodicidad: parsed.data.periodicidad,
      fechaInicio: parsed.data.fechaInicio,
      notas: parsed.data.notas ?? null,
      items: parsed.data.items.map((i) => ({
        productoId: i.productoId,
        precio: i.precio,
        ivaTasa: i.ivaTasa ?? null,
        visitasPorPeriodo: i.visitasPorPeriodo ?? null,
      })),
    });
    return NextResponse.json(suscripcion, { status: 201 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
