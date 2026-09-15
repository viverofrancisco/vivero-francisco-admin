import { NextResponse } from "next/server";
import { mediaItemSchema, requestUploadUrlsSchema } from "@vivero/shared";
import { z } from "zod/v4";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import {
  addVisitaMedia,
  requestVisitaMediaUploads,
} from "@/lib/services/visita.service";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Sin lista de roles: `ensurePuedeTocarArchivos` decide —la oficina y el
  // jardinero **asignado**, nunca el cliente—. Decía "ADMIN" y nada más, así
  // que quien está en el jardín no podía subir la foto que acababa de sacar.
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = requestUploadUrlsSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const uploads = await requestVisitaMediaUploads(
      id,
      viewerFromMobileUser(userOrResponse),
      parsed.data.files
    );
    return NextResponse.json({ uploads });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

const confirmarSchema = z.object({ files: z.array(mediaItemSchema).min(1) });

/**
 * Confirma en la base los archivos ya subidos a R2.
 *
 * El teléfono no tenía cómo: las fotos viajaban **dentro del parte**, así que
 * subir una foto obligaba a llenar el parte, y sacar una foto a mitad de la
 * mañana no era posible. Los archivos son de la visita y no de un formulario
 * —se sacan mientras se trabaja— así que se confirman solos, en cualquier
 * estado.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = confirmarSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  try {
    const media = await addVisitaMedia(
      id,
      viewerFromMobileUser(userOrResponse),
      parsed.data.files
    );
    return NextResponse.json({ media });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
