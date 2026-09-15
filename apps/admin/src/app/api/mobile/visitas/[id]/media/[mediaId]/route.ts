import { NextResponse } from "next/server";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { z } from "zod/v4";
import {
  etiquetarVisitaMedia,
  removeVisitaMedia,
} from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  // Sin lista de roles: `ensurePuedeTocarArchivos` decide —la oficina y el
  // jardinero **asignado**, nunca el cliente—. Decía "ADMIN" y nada más, así
  // que quien está en el jardín no podía subir la foto que acababa de sacar.
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const { id, mediaId } = await params;
  try {
    await removeVisitaMedia(id, mediaId, viewerFromMobileUser(userOrResponse));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const etiquetaSchema = z.object({
  /** `null` saca la etiqueta: una foto sin tarea también es válida. */
  tareaId: z.string().min(1).nullable(),
});

/**
 * Cambiar a qué tarea corresponde un archivo.
 *
 * El servicio acepta **cualquier tarea viva**, no solo las que se marcaron en
 * la visita: en el campo se fotografía lo que aparece —un problema de riego
 * durante una poda— y limitar la etiqueta a lo que uno hizo deja esas fotos sin
 * clasificar, que es justo lo que le impide al informe ponerlas en su sección.
 *
 * Existía en el servicio y en el portal, y en el móvil no había ruta: desde el
 * teléfono se podía etiquetar al subir y nunca corregir.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = etiquetaSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id, mediaId } = await params;
  try {
    const media = await etiquetarVisitaMedia(
      id,
      mediaId,
      parsed.data.tareaId,
      viewerFromMobileUser(userOrResponse)
    );
    return NextResponse.json(media);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
