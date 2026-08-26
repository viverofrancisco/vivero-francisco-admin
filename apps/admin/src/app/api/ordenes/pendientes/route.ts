import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import {
  listarPendientes,
  VISITAS_SIN_TOPE,
} from "@/lib/services/orden.service";
import { productosSuscritos } from "@/lib/services/suscripcion.service";
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

/** Trabajo hecho y todavía no facturado, para previsualizar antes de generar. */
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
    const [items, suscritos] = await Promise.all([
      listarPendientes(
        viewer,
        parsed.data.clienteId,
        parsed.data.desde ? new Date(parsed.data.desde) : DESDE_SIEMPRE,
        parsed.data.hasta ? new Date(parsed.data.hasta) : finDelMesActual(),
        // Las visitas no se cortan en el mes: se le puede asignar a la orden
        // una que está agendada para más adelante.
        VISITAS_SIN_TOPE
      ),
      // Van juntos porque el editor los necesita a la vez: qué falta cobrar y
      // qué no se puede agregar a mano por estar ya en un plan.
      productosSuscritos(parsed.data.clienteId),
    ]);
    return NextResponse.json({ items, suscritos });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
