import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { guardarOpciones } from "@/lib/services/variante.service";
import { opcionesSchema } from "@/lib/validations/producto";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Reemplaza los ejes del producto y regenera sus variantes.
 *
 * Es un reemplazo entero, no un parche: lo que llega es el estado final. Lo que
 * sobrevive es lo que sigue teniendo sentido — una variante cuya combinación no
 * cambió conserva su SKU, su stock y su foto.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  const parsed = opcionesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  try {
    // Devuelve las variantes que quedaron, con sus valores: quien acaba de
    // agregar un eje les puso precio y stock, y necesita saber qué id le tocó
    // a cada combinación para poder mandárselos.
    const variantes = await guardarOpciones(viewer, id, parsed.data.opciones, {
      descartarVariantes: parsed.data.descartarVariantes,
    });
    return NextResponse.json({ variantes, total: variantes.length });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
