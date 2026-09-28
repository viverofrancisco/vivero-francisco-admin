import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { listarCategorias } from "@/lib/services/categoria.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { publicUrlForKey } from "@/lib/s3";

/**
 * Las categorías, aplanadas para la fila del teléfono: el nombre, cuántos
 * productos vivos tiene y su foto. Es lo que el selector de categorías del
 * producto lista con su casilla, como las colecciones de Shopify.
 */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  try {
    const categorias = await listarCategorias(viewerFromMobileUser(userOrResponse));
    return NextResponse.json({
      categorias: categorias.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        productos: c._count.productos,
        imagenUrl: c.media ? publicUrlForKey(c.media.key) : null,
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
