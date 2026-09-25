import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { editarFotoDeVisita, editarImagen } from "@/lib/services/media.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";
import { edicionDeImagenSchema } from "@/lib/validations/producto";

/**
 * Recortar, girar o voltear una imagen desde la app y recibir **otra**: la
 * gemela de `/api/media/[id]/editar`, con el mismo schema y el mismo
 * servicio. El recorte se dibuja en el teléfono y se aplica acá, con sharp,
 * igual que el del portal: así no hay un recortador nativo que mantener y la
 * foto de una visita sigue quedando intacta.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;
  const { id } = await params;
  const parsed = edicionDeImagenSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  try {
    const viewer = viewerFromMobileUser(userOrResponse);
    const { origen, ...edicion } = parsed.data;
    const media =
      origen === "visita"
        ? await editarFotoDeVisita(viewer, id, edicion)
        : await editarImagen(viewer, id, edicion);
    return NextResponse.json({ media });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
