import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { emitirNotaCredito } from "@/lib/services/factura.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

const cuerpo = z.object({
  /** Sale impreso en la nota: es lo que explica la devolución. */
  motivo: z.string().min(1, "La nota de crédito necesita un motivo"),
});

/** La nota de crédito que corrige una factura autorizada, desde el teléfono. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const parsed = cuerpo.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(
      await emitirNotaCredito(viewerFromMobileUser(userOrResponse), id, {
        motivo: parsed.data.motivo,
      })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
