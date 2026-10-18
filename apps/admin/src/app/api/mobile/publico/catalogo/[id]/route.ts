import { NextResponse } from "next/server";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { productoDelCatalogo } from "@/lib/services/catalogo.service";

/** La ficha de un producto, sin sesión. Ver `../route.ts`. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    return NextResponse.json(await productoDelCatalogo(id, {
        // El drawer de *Elegir opciones* no muestra recomendaciones.
        ligero: new URL(request.url).searchParams.get("ligero") === "1",
      }));
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
