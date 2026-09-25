import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { listarPendientes } from "@/lib/services/orden.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/** Antes del portal no hay nada que facturar, así que sirve de piso. */
const DESDE_SIEMPRE = new Date(Date.UTC(2000, 0, 1));

/** Tope: no se ofrecen períodos que todavía no empezaron. */
function finDelMesActual(): Date {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
}

/** Los períodos de plan de un cliente todavía sin orden, para ofrecerlos al armar una desde el teléfono. */
export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const clienteId = new URL(request.url).searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "Falta clienteId" }, { status: 400 });
  }
  try {
    const items = await listarPendientes(
      viewerFromMobileUser(userOrResponse),
      clienteId,
      DESDE_SIEMPRE,
      finDelMesActual()
    );
    return NextResponse.json({
      items: items.map((p) => ({
        suscripcionId: p.suscripcionId,
        suscripcionNumero: p.suscripcionNumero,
        propiedad: p.propiedad,
        descripcion: p.descripcion,
        precio: Number(p.precio),
        ivaTasa: Number(p.ivaTasa),
        periodoInicio: p.periodoInicio.toISOString(),
        periodoFin: p.periodoFin.toISOString(),
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
