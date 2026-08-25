import { NextResponse } from "next/server";
import {
  generarBorradoresDeVisitas,
  generarRenovaciones,
} from "@/lib/services/orden.service";

/**
 * Arma los borradores que faltan: períodos de suscripción vencidos y visitas
 * completadas que se quedaron sin orden.
 *
 * Diario e idempotente: lo que ya tiene orden se saltea. Deja todo en BORRADOR
 * a propósito — el cron arma el trabajo, la decisión de cobrar sigue siendo de
 * una persona, que hasta facturar puede ajustar precios o sumar adicionales.
 *
 * Lo de las visitas es una **red**: lo normal es que la orden nazca al
 * completar la visita, y esto agarra lo que se escapó.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const [suscripciones, visitas] = await Promise.all([
      generarRenovaciones(),
      generarBorradoresDeVisitas(),
    ]);
    return NextResponse.json({
      suscripciones: {
        creadas: suscripciones.creadas.length,
        omitidas: suscripciones.omitidas.length,
        // Las omitidas necesitan que alguien haga algo (vincular un producto),
        // así que van con detalle en la respuesta del cron.
        detalleOmitidas: suscripciones.omitidas,
      },
      visitas: {
        creadas: visitas.creadas.length,
        omitidas: visitas.omitidas.length,
        detalleOmitidas: visitas.omitidas,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
