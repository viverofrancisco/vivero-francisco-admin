import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requestUploadUrlsSchema } from "@vivero/shared";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";
import { prisma } from "@/lib/prisma";
import { getUploadUrl } from "@/lib/s3";
import {
  serviceErrorResponse,
  viewerFromMobileUser,
} from "@/lib/mobile/route-helpers";

/**
 * URLs para que el cliente suba las fotos de su calificación.
 *
 * Van a un prefijo propio en R2 y no al de la visita: las de la visita son las
 * del trabajo, etiquetadas por tarea, y son las que arman el informe. Una foto
 * de queja del cliente terminaría impresa en el documento que se le entrega a
 * él mismo.
 *
 * El `contentType` es lo que se **firma**, así que la URL solo sirve para el
 * tipo que se pidió; validarlo acá es lo que impide que llegue cualquier cosa.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = requestUploadUrlsSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { id } = await params;
  const viewer = viewerFromMobileUser(userOrResponse);
  try {
    // Solo el dueño de la visita, y la misma regla que al guardar: sin esto,
    // cualquiera con sesión podría pedir URLs firmadas para el bucket.
    const visita = await prisma.visita.findFirst({
      where: { id, deletedAt: null },
      select: { clienteId: true },
    });
    if (!visita) {
      return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
    }
    if (viewer.clienteId === null || viewer.clienteId !== visita.clienteId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const uploads = await Promise.all(
      parsed.data.files.map(async (file) => {
        const ext = file.fileName.split(".").pop() || "jpg";
        const key = `calificaciones/${id}/${randomUUID()}.${ext}`;
        return {
          key,
          uploadUrl: await getUploadUrl(key, file.contentType),
          contentType: file.contentType,
        };
      })
    );
    return NextResponse.json({ uploads });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
