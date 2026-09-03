import { NextResponse } from "next/server";
import { sincronizarPendientes } from "@/lib/services/factura.service";
import { sincronizarPendientesSri } from "@/lib/sri/emision";

/**
 * Relee las facturas que todavía pueden cambiar, de los dos lados.
 *
 * **Contífico** firma y transmite en su tanda horaria, así que hay que
 * preguntarle. **El SRI** puede tardar hasta 24 horas por norma —en la práctica
 * contesta en segundos— y cuando no contesta en el momento, la factura queda
 * enviada y sin resolver: si nadie vuelve a preguntar, se queda así para
 * siempre con su número consumido.
 *
 * Los dos barridos son idempotentes —solo copian lo que dice el otro lado— así
 * que repetirlo no rompe nada. Y van por separado: que Contífico esté caído no
 * tiene por qué dejar sin resolver una factura propia.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // `allSettled`: un lado que falla no se lleva al otro, y la respuesta dice
  // qué pasó con cada uno.
  const [contifico, sri] = await Promise.allSettled([
    sincronizarPendientes(),
    sincronizarPendientesSri(),
  ]);

  const resultado = (r: PromiseSettledResult<unknown>) =>
    r.status === "fulfilled"
      ? r.value
      : { error: r.reason instanceof Error ? r.reason.message : "Error" };

  return NextResponse.json({
    contifico: resultado(contifico),
    sri: resultado(sri),
  });
}
