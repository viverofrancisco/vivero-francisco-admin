import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { listarPendientes } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { pendientesQuerySchema } from "@/lib/validations/orden";

/** Antes del portal no hay nada que facturar, así que sirve de piso. */
const DESDE_SIEMPRE = new Date(Date.UTC(2000, 0, 1));

/**
 * Tope por defecto. No se ofrecen períodos de suscripción que todavía no
 * empezaron: cobrar por adelantado tiene que ser una decisión explícita.
 */
function finDelMesActual(): Date {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
}

/** Períodos de plan todavía sin orden, para ofrecerlos al armar una. */
export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const { searchParams } = new URL(request.url);
  const parsed = pendientesQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const items = await listarPendientes(
      viewer,
      parsed.data.clienteId,
      parsed.data.desde ? new Date(parsed.data.desde) : DESDE_SIEMPRE,
      parsed.data.hasta ? new Date(parsed.data.hasta) : finDelMesActual()
    );
    return NextResponse.json({ items });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
