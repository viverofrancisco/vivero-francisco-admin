import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { viewerFromSession } from "@/lib/auth-helpers";
import { chatUploadUrlsSchema } from "@vivero/shared";
import { getUploadUrl, publicUrlForKey } from "@/lib/s3";
import { prisma } from "@/lib/prisma";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { ForbiddenError, NotFoundError } from "@/lib/services/errors";

/**
 * Las URLs firmadas para subir las fotos de un mensaje.
 *
 * Prefijo propio (`chats/…`), no la biblioteca de `Media`: esa es el catálogo
 * del que los productos eligen fotos, y lo que alguien manda en un chat no
 * tiene nada que hacer ahí.
 *
 * El `contentType` es lo que se **firma**, así que la regla de "solo imágenes"
 * vive en el schema y no en la pantalla: R2 guarda lo que llegue con la firma
 * que le dimos.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const viewer = await viewerFromSession();
    if (viewer.role === "CLIENTE") throw new ForbiddenError();
    const chat = await prisma.chat.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!chat) throw new NotFoundError("Chat no encontrado");
    const miembro = await prisma.chatMiembro.count({
      where: { chatId: id, userId: viewer.id, salioEl: null },
    });
    if (miembro === 0) throw new ForbiddenError("No estás en este chat.");

    const parsed = chatUploadUrlsSchema.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const uploads = await Promise.all(
      parsed.data.files.map(async (file) => {
        const ext = file.fileName.split(".").pop() || "jpg";
        const key = `chats/${id}/${randomUUID()}.${ext}`;
        return {
          key,
          url: publicUrlForKey(key),
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
