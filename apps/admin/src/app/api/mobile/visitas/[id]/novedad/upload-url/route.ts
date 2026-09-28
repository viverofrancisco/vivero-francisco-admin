import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { MAX_FOTOS_NOVEDAD, archivoSubibleSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { prisma } from "@/lib/prisma";
import { getUploadUrl } from "@/lib/s3";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/** Solo imágenes: un video de un portón no dice más que la foto. */
const bodySchema = z.object({
  files: z
    .array(
      archivoSubibleSchema.refine(
        (f) => f.contentType.startsWith("image/"),
        "La foto de una novedad tiene que ser una imagen."
      )
    )
    .min(1)
    .max(MAX_FOTOS_NOVEDAD),
});

/**
 * Las URLs para subir las fotos de una novedad —el portón cerrado, la nota
 * pegada—. El gemelo de `/calificacion/upload-urls`: una tanda firmada de una,
 * y la novedad se manda después con las claves.
 *
 * Van a un prefijo propio en R2 y no al de la visita: las fotos de la visita
 * son las del trabajo, etiquetadas por tarea, y arman el informe que se le
 * entrega al cliente. Un portón cerrado no tiene que terminar impreso ahí.
 *
 * Solo el asignado, que es quien reporta; el `contentType` es lo que se firma.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "PERSONAL");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { id } = await params;
  try {
    const asignado = await prisma.visitaPersonal.findFirst({
      where: {
        visitaId: id,
        removedAt: null,
        personalId: userOrResponse.personalId ?? "ninguno",
        visita: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!asignado) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const uploads = await Promise.all(
      parsed.data.files.map(async (file) => {
        const ext = file.fileName.split(".").pop() || "jpg";
        const key = `novedades/${id}/${randomUUID()}.${ext}`;
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
