import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { busquedaDeMensajesSchema } from "@vivero/shared";
import { buscarMensajes } from "@/lib/services/chat.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";

/**
 * Buscar entre los mensajes de los chats donde uno está.
 *
 * Busca en el texto y en el nombre de los archivos: una foto no tiene
 * palabras, así que lo único por lo que se la encuentra es cómo se llamaba
 * cuando la mandaron.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = busquedaDeMensajesSchema.safeParse({
    q: searchParams.get("q") ?? "",
    limit: searchParams.get("limit") ?? undefined,
  });
  // Menos de dos letras no es una búsqueda: devolvemos vacío en vez de un
  // error, porque la pantalla busca mientras se escribe.
  if (!parsed.success) return NextResponse.json({ items: [] });

  try {
    return NextResponse.json({
      items: await buscarMensajes(
        await viewerFromSession(),
        parsed.data.q,
        parsed.data.limit
      ),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
