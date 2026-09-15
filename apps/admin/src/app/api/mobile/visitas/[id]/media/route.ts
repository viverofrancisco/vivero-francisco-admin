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

/**
 * `tareaId` obligatorio, a diferencia del `mediaItemSchema` general.
 *
 * Una foto sin tarea es exactamente la que el informe no puede ubicar: queda en
 * el montón suelto y alguien la clasifica después, mirándola y tratando de
 * acordarse de qué era. El único momento en que se sabe la respuesta es cuando
 * se saca, y ahí es donde la app la pide.
 *
 * Que lo exija el servidor y no solo la pantalla es lo que hace que sea una
 * regla. Lo que **no** cambia es `PATCH`, que sigue aceptando `null`: las fotos
 * viejas ya vienen sin etiqueta y la oficina tiene que poder moverlas.
 */
const confirmarSchema = z.object({
  files: z
    .array(mediaItemSchema.extend({ tareaId: z.string().min(1) }))
    .min(1),
});

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
