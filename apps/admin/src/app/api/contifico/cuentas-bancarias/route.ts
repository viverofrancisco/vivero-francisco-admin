import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { isAdminRole } from "@/lib/services/viewer";
import { listarCuentasBancarias } from "@/lib/contifico/bancos";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Las cuentas del vivero, para elegir dónde entró una transferencia. */
export async function GET() {
  const viewer = await viewerFromSession();
  if (!isAdminRole(viewer.role) && viewer.role !== "PERSONAL_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const cuentas = await listarCuentasBancarias();
    return NextResponse.json({
      cuentas: cuentas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        numero: c.numero,
        tipo: c.tipo_cuenta === "CC" ? "Corriente" : "Ahorros",
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
