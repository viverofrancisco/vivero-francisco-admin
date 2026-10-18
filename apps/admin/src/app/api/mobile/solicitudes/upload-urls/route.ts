import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { MAX_ADJUNTOS_SOLICITUD, requestUploadUrlsSchema } from "@vivero/shared";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { getUploadUrl } from "@/lib/s3";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { prefijoDeAdjuntos } from "@/lib/services/solicitud.service";

/**
 * URLs para que el cliente suba fotos o videos de su jardín **antes** de
 * mandar la solicitud; al mandarla van sus `key` y `crearSolicitud` comprueba
 * que estén bajo su prefijo.
 *
 * Solo un cliente con sesión: el invitado no adjunta, porque firmar subidas
 * al bucket sin saber quién pide es abrirlo a cualquiera. El `contentType` es
 * lo que se firma (`archivoSubibleSchema`: solo imágenes y videos).
 */
export async function POST(request: Request) {
  const user = await requireMobileRole(request, "CLIENTE");
  if (!isMobileUser(user)) return user;
  if (!user.clienteId) {
    return NextResponse.json({ error: "Sin cliente" }, { status: 403 });
  }
  const parsed = requestUploadUrlsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || parsed.data.files.length > MAX_ADJUNTOS_SOLICITUD) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const prefijo = prefijoDeAdjuntos(user.clienteId);
  try {
    const uploads = await Promise.all(
      parsed.data.files.map(async (file) => {
        const ext = (file.fileName.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "jpg";
        const key = `${prefijo}${randomUUID()}.${ext}`;
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
