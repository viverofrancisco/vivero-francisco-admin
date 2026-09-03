import { NextResponse } from "next/server";
import { sincronizarPendientesSri } from "@/lib/sri/emision";

/**
 * Relee las facturas que el SRI todavía no resolvió.
 *
 * Por norma tiene hasta 24 horas para autorizar —en la práctica contesta en
 * segundos— y cuando no contesta en el momento la factura queda enviada y sin
 * resolver: si nadie vuelve a preguntar, se queda así para siempre con su
 * número consumido.
 *
 * Es idempotente —solo copia lo que dice el SRI— así que repetirlo no rompe
 * nada.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return NextResponse.json(await sincronizarPendientesSri());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
