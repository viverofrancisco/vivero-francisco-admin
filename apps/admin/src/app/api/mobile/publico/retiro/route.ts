import { NextResponse } from "next/server";
import { ubicacionesDeRetiro } from "@/lib/services/ubicacion.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Dónde se puede retirar un pedido, **sin sesión**, para el checkout del
 * invitado: las ubicaciones activas con retiro. Es lo mismo que el vivero
 * publica en su vidriera —nombre, dirección, horario—, así que no hace falta
 * saber quién pregunta. El twin con sesión es `/api/mobile/pedidos/retiro`.
 */
export async function GET() {
  try {
    return NextResponse.json({ ubicaciones: await ubicacionesDeRetiro() });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
