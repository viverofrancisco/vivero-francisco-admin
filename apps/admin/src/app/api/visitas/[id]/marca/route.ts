import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { viewerFromSession } from "@/lib/auth-helpers";
import { marcarEntrada, marcarSalida } from "@/lib/services/visita.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Lo que manda el navegador o el teléfono al marcar.
 *
 * La ubicación es opcional y se valida igual: una latitud de 200 no existe, y
 * guardarla sería guardar basura que después nadie sabe leer. Sin ubicación se
 * marca lo mismo — ver `marcarEntrada` para por qué.
 */
const ubicacionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Radio en metros. Negativo no significa nada. */
  precision: z.number().min(0).nullable().optional(),
  simulada: z.boolean().nullable().optional(),
});

const bodySchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("ENTRADA"),
    personalId: z.string().min(1).optional(),
    ubicacion: ubicacionSchema.nullable().optional(),
  }),
  z.object({
    tipo: z.literal("SALIDA"),
    personalId: z.string().min(1).optional(),
    ubicacion: ubicacionSchema.nullable().optional(),
    // Al salir se dice qué se hizo: recién ahí se sabe.
    tareaIds: z.array(z.string().min(1)),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { id } = await params;
  const datos = parsed.data;
  try {
    const visita =
      datos.tipo === "ENTRADA"
        ? await marcarEntrada(id, viewer, {
            personalId: datos.personalId,
            ubicacion: datos.ubicacion ?? undefined,
          })
        : await marcarSalida(id, viewer, {
            personalId: datos.personalId,
            ubicacion: datos.ubicacion ?? undefined,
            tareaIds: datos.tareaIds,
          });
    return NextResponse.json(visita);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
