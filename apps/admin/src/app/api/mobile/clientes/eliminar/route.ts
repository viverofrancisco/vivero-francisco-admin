import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { bulkSoftDeleteClientes } from "@/lib/services/cliente.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

const eliminarSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

/**
 * Archivar clientes de a varios, desde la app.
 *
 * Acá el borrado **es un `updateMany`** y no una pasada uno por uno: archivar
 * un cliente no tiene nada que revisar —ni cuentas que cortar ni documentos que
 * lo impidan—, así que no hay fallas que nombrar. Igual responde con la forma
 * de `ResultadoEnLote`, para que la pantalla no tenga que distinguir.
 */
export async function POST(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = eliminarSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const { count } = await bulkSoftDeleteClientes(
      viewerFromMobileUser(userOrResponse),
      parsed.data.ids
    );
    return NextResponse.json({ eliminados: count, errores: [] });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
