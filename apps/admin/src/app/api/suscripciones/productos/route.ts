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
    const items = await productosSuscribibles(
      viewer,
      clienteId,
      // Al editar, los productos de esa misma suscripción siguen disponibles.
      params.get("exceptoSuscripcionId") ?? undefined
    );
    return NextResponse.json({
      items: items.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        ivaTasa: p.ivaTasa != null ? Number(p.ivaTasa) : null,
        sincronizado: p.contificoProductoId !== null,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
