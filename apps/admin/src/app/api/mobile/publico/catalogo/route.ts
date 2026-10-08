import { NextResponse } from "next/server";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { listarCatalogo } from "@/lib/services/catalogo.service";

/**
 * El catálogo **sin sesión**, para el modo invitado: lo mismo que ve un
 * cliente. No muestra nada que no esté ya en la vidriera —productos activos,
 * foto y precio con IVA—, así que no hace falta saber quién pregunta.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 40);
  try {
    return NextResponse.json(
      await listarCatalogo({
        search: url.searchParams.get("search") ?? undefined,
        offset: Number.isFinite(offset) ? offset : 0,
        limit: Number.isFinite(limit) ? limit : 40,
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
