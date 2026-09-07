import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { productosSuscribibles } from "@/lib/services/suscripcion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Productos recurrentes que un cliente todavía no tiene activos. */
export async function GET(request: Request) {
  const viewer = await viewerFromSession();
  const params = new URL(request.url).searchParams;
  const clienteId = params.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "Falta clienteId" }, { status: 400 });
  }
  try {
    const { items, hayMas } = await productosSuscribibles(
      viewer,
      clienteId,
      // Al editar, los productos de esa misma suscripción siguen disponibles.
      params.get("exceptoSuscripcionId") ?? undefined,
      {
        search: params.get("q") ?? undefined,
        offset: Number(params.get("offset")) || 0,
        limit: Number(params.get("limit")) || 20,
      }
    );
    return NextResponse.json({
      items: items.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        ivaTasa: p.ivaTasa != null ? Number(p.ivaTasa) : null,
      })),
      hayMas,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
