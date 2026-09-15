import { NextResponse } from "next/server";
import { mediaItemSchema, requestUploadUrlsSchema } from "@vivero/shared";
import { z } from "zod/v4";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import {
  addVisitaMedia,
  etiquetarVisitaMediaMuchas,
  removeVisitaMediaMuchas,
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
const confirmarSchema = z
  .object({
    files: z
      .array(mediaItemSchema.extend({ tareaId: z.string().min(1) }))
      .default([]),
    /** Las que se sacan, en la misma tanda. */
    eliminar: z.array(z.string().min(1)).default([]),
    /** Las que cambian de tarea, en la misma tanda. */
    etiquetar: z
      .array(z.object({ id: z.string().min(1), tareaId: z.string().min(1) }))
      .default([]),
  })
  .refine(
    (d) => d.files.length > 0 || d.eliminar.length > 0 || d.etiquetar.length > 0,
    { message: "No hay nada que guardar" },
  );

/**
 * Guarda los cambios de archivos de una visita: lo que entra y lo que sale.
 *
 * Las tres cosas —agregar, quitar y reetiquetar— en una sola llamada porque son
 * un solo gesto. Borrar era una llamada por foto y reetiquetar otra: sacar
 * cinco eran cinco viajes, cinco oportunidades de que uno falle y ninguna forma
 * de arrepentirse a mitad de camino. Ahora la pantalla junta todo detrás de un
 * *Guardar* y esto lo aplica junto.
 *
 * Antes de esto el teléfono no tenía cómo subir nada suelto: las fotos viajaban
 * **dentro del parte**, así que sacar una a mitad de la mañana no era posible.
 * Los archivos son de la visita y no de un formulario.
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
  const viewer = viewerFromMobileUser(userOrResponse);
  try {
    // Primero lo que sale. Al revés, una foto nueva podría entrar y salir en la
    // misma tanda si alguien manda su id en las dos listas. Reetiquetar va
    // después de borrar y antes de agregar: una foto que se va no necesita
    // etiqueta nueva, y una que recién entra ya trae la suya.
    await removeVisitaMediaMuchas(id, parsed.data.eliminar, viewer);
    await etiquetarVisitaMediaMuchas(id, parsed.data.etiquetar, viewer);
    const media = await addVisitaMedia(id, viewer, parsed.data.files);
    return NextResponse.json({ media });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
