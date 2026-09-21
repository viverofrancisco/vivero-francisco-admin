import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { eliminarEnLoteSchema } from "@/lib/validations/servicio";
import { archivarVariosProductos } from "@/lib/services/servicio.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * POST y no DELETE: manda un cuerpo con los ids, y un DELETE con cuerpo lo
 * descartan proxies y clientes sin avisar.
 *
 * Responde 200 aunque alguno no se haya podido archivar —estar en el plan de un
 * cliente lo impide—: la pantalla necesita saber cuáles salieron y cuáles no.
 */
export async function POST(request: Request) {
  const parsed = eliminarEnLoteSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await archivarVariosProductos(await viewerFromSession(), parsed.data.ids)
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
