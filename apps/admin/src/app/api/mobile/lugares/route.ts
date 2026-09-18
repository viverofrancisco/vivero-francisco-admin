import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";

/**
 * Buscar una dirección desde la app, con Places por nuestra cuenta.
 *
 * La clave se queda en el servidor por lo mismo que el mapa: se protege por
 * dominio y una app nativa no tiene dominio que mandar. Además cada consulta se
 * factura, así que la ruta pide sesión de oficina —no es un buscador abierto—.
 *
 * **El `sessionToken` lo manda la app y hay que respetarlo.** Google agrupa
 * todas las teclas de una misma búsqueda bajo ese token y las cobra como una
 * sola consulta, cerrando la sesión cuando se piden los datos del lugar
 * elegido. Sin él, escribir "ribera del buijo" son dieciséis consultas.
 */
const consulta = z.object({
  q: z.string().trim().min(3).max(200),
  /** Un id que la app genera al empezar a escribir y repite hasta elegir. */
  sesion: z.string().min(8).max(64).optional(),
});

export async function GET(request: Request) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const clave = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!clave) {
    return NextResponse.json(
      { error: "El buscador no está configurado en el servidor." },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const parsed = consulta.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ items: [] });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": clave,
      },
      body: JSON.stringify({
        input: parsed.data.q,
        // Sesgado a Ecuador, que es donde están todas las propiedades.
        includedRegionCodes: ["ec"],
        languageCode: "es",
        ...(parsed.data.sesion ? { sessionToken: parsed.data.sesion } : {}),
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "No pudimos buscar." }, { status: 502 });
  }

  if (!respuesta.ok) {
    // El texto de Google dice qué falta —la API sin habilitar, la clave
    // restringida— y esconderlo detrás de "sin resultados" es lo que hace
    // perder una tarde.
    const detalle = await respuesta.text().catch(() => "");
    console.error(
      `[lugares] Places respondió ${respuesta.status}: ${detalle.slice(0, 300)}`
    );
    return NextResponse.json({ error: "No pudimos buscar." }, { status: 502 });
  }

  const datos = (await respuesta.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        text?: { text?: string };
      };
    }[];
  };

  const items = (datos.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    return [
      {
        id: p.placeId,
        principal: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secundario: p.structuredFormat?.secondaryText?.text ?? "",
      },
    ];
  });

  return NextResponse.json({ items });
}
