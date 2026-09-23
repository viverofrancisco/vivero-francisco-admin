import { NextResponse } from "next/server";

/**
 * "¿Hay alguien?" Sin sesión y sin cuerpo: es lo que la app sondea cada
 * cinco segundos cuando un pedido no llegó, para saber cuándo volvió la
 * señal y sacar el "Conectando…" de la pantalla. No dice nada de nadie.
 */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
