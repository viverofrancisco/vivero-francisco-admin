import { NextResponse } from "next/server";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";

/**
 * Los datos del lugar elegido: la calle y la ciudad, para completar la ficha.
 *
 * **Devuelve dónde queda (`lat`/`lng`) para llevar el mapa hasta ahí, y la app
 * nunca lo guarda como pin.** Lo que Google contesta por "Blue Bay, Isla
 * Mocolí" es el centro de la urbanización, que es justo el dato que el pin
 * viene a reemplazar: doscientas casas comparten ese punto. Guardarlo como si
 * fuera la puerta es peor que no tener pin, porque después nadie sabe que era
 * aproximado. El mapa queda en el barrio y el pin se pone tocando, como en el
 * portal.
 *
 * Pedir los datos del lugar es también lo que **cierra la sesión** de búsqueda,
 * así que el mismo `sesion` que se usó al escribir viaja acá: con eso Google
 * cobra toda la búsqueda como una consulta.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrResponse = await requireMobileRole(request, "ADMIN", "STAFF");
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const clave = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!clave) {
    return NextResponse.json(
      { error: "El buscador no está configurado en el servidor." },
      { status: 404 }
    );
  }

  const { id } = await params;
  const sesion = new URL(request.url).searchParams.get("sesion");
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`);
  url.searchParams.set("languageCode", "es");
  if (sesion) url.searchParams.set("sessionToken", sesion);

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": clave,
        "X-Goog-FieldMask": "formattedAddress,addressComponents,location",
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "No pudimos leer el lugar." }, { status: 502 });
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    console.error(
      `[lugares] Detalle respondió ${respuesta.status}: ${detalle.slice(0, 300)}`
    );
    return NextResponse.json({ error: "No pudimos leer el lugar." }, { status: 502 });
  }

  const datos = (await respuesta.json()) as {
    formattedAddress?: string;
    addressComponents?: { longText?: string; types?: string[] }[];
    location?: { latitude?: number; longitude?: number };
  };

  const parte = (tipo: string) =>
    datos.addressComponents?.find((c) => c.types?.includes(tipo))?.longText ?? null;

  const calle = parte("route");
  const numero = parte("street_number");

  return NextResponse.json({
    direccion: [calle, numero].filter(Boolean).join(" ") || datos.formattedAddress || null,
    numeroCasa: numero,
    // `locality` es la ciudad; en algunas zonas de Ecuador viene solo el cantón.
    ciudad: parte("locality") ?? parte("administrative_area_level_2"),
    completa: datos.formattedAddress ?? null,
    lat: datos.location?.latitude ?? null,
    lng: datos.location?.longitude ?? null,
  });
}
