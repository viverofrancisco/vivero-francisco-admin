import { NextResponse } from "next/server";
import { sincronizarPendientes } from "@/lib/services/factura.service";

/**
 * Relee en Contífico las facturas que todavía pueden cambiar.
 *
 * Cada hora, que es el ritmo al que Contífico firma y transmite: correrlo más
 * seguido solo suma llamadas. Es idempotente —solo copia lo que dice Contífico—
 * así que repetirlo no rompe nada.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    return NextResponse.json(await sincronizarPendientes());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 }
    );
  }
}
