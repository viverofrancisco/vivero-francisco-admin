import { NextResponse } from "next/server";
import { generarRenovaciones } from "@/lib/services/orden.service";

/**
 * Arma los borradores de los períodos de suscripción que vencieron.
 *
 * Diario e idempotente: lo que ya tiene orden se saltea. Deja todo en BORRADOR
 * a propósito — el cron arma el trabajo, la decisión de cobrar sigue siendo de
 * una persona, que hasta facturar puede ajustar precios o sumar adicionales.
 *
 * **Las visitas ya no entran acá.** Corría además una red que le armaba un
 * borrador a toda visita completada que se hubiera quedado sin orden. Se fue
 * con los productos de la visita: lo que una visita deja hoy son tareas hechas,
 * que no tienen precio, así que no hay nada que un automatismo pueda poner en
 * una orden. Con un plan sí se puede, porque ahí el precio está pactado.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const suscripciones = await generarRenovaciones();
    return NextResponse.json({
      suscripciones: {
        creadas: suscripciones.creadas.length,
        omitidas: suscripciones.omitidas.length,
        // Las omitidas necesitan que alguien haga algo —una suscripción sin
        // productos activos, por ejemplo— así que van con detalle.
        detalleOmitidas: suscripciones.omitidas,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
