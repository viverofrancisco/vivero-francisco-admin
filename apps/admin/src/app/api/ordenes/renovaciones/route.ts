import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { generarRenovaciones } from "@/lib/services/orden.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { isAdminRole } from "@/lib/services/viewer";
import { ForbiddenError } from "@/lib/services/errors";

/**
 * Dispara la generación de renovaciones a mano.
 *
 * Es la misma función que corre el cron, así que es igual de idempotente. Existe
 * para poder ponerse al día sin esperar al día siguiente cuando el cron falló, o
 * después de vincular un producto que había quedado suelto.
 */
export async function POST() {
  const viewer = await viewerFromSession();
  try {
    if (!isAdminRole(viewer.role)) throw new ForbiddenError();
    const resultado = await generarRenovaciones();
    return NextResponse.json({
      creadas: resultado.creadas.length,
      omitidas: resultado.omitidas,
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
