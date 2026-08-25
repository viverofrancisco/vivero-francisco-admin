import { NextResponse } from "next/server";
import { generarRenovaciones } from "@/lib/services/orden.service";

/**
 * Crea los borradores de las suscripciones cuyo período ya venció.
 *
 * Diario y idempotente: lo que ya tiene orden se saltea. Deja todo en BORRADOR
 * a propósito — el cron arma el trabajo, la decisión de cobrar sigue siendo de
 * una persona, que hasta confirmar puede ajustar precios o sumar adicionales.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultado = await generarRenovaciones();
    return NextResponse.json({
      creadas: resultado.creadas.length,
      omitidas: resultado.omitidas.length,
      // Las omitidas necesitan que alguien haga algo (vincular un producto),
      // así que van con detalle en la respuesta del cron.
      detalleOmitidas: resultado.omitidas,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
