import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { emitirNotaCredito } from "@/lib/services/factura.service";

const cuerpo = z.object({
  /** Sale impreso en la nota: es lo que explica la devolución. */
  motivo: z.string().min(1, "La nota de crédito necesita un motivo"),
});

/** Emite la nota de crédito que corrige una factura propia autorizada. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
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
      await emitirNotaCredito(viewer, id, { motivo: parsed.data.motivo })
    );
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
