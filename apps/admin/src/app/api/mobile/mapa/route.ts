import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileUser, isMobileUser } from "@/lib/mobile/auth";

/**
 * La estampa del mapa de una propiedad, servida por nosotros.
 *
 * **Por qué pasa por acá y no va directo a Google.** La clave del mapa se
 * restringe por dominio, que es lo que la protege en el navegador; desde una
 * app nativa no hay dominio que mandar, así que una clave puesta en el teléfono
 * solo se puede proteger dejándola abierta —o sea, no protegiéndola— y encima
 * viaja adentro del bundle, donde cualquiera la saca. Acá la clave se queda en
 * el servidor, la app pide una imagen y listo.
 *
 * Es Static Maps y no un mapa de verdad: en la ficha de la visita lo que hace
 * falta es reconocer la manzana de un vistazo y salir a manejar —eso lo hace
 * *Llegar*—, no explorar con el pulgar. Un mapa interactivo sería
 * `react-native-maps`: módulo nativo, una clave más para Android y reconstruir
 * la app, para una postal de 150 px.
 *
 * **Sin la clave devuelve 404 a propósito**: la app ya sabe dibujar su panel de
 * franjas cuando esto no contesta, así que la tarjeta sigue funcionando y lo
 * único que falta es la foto.
 */
const consulta = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  // Píxeles lógicos: Static Maps los multiplica por `scale`. Con tope, porque
  // el tamaño lo manda el cliente y cada pedido se factura.
  ancho: z.coerce.number().int().min(80).max(640).default(400),
  alto: z.coerce.number().int().min(60).max(640).default(150),
  zoom: z.coerce.number().int().min(1).max(20).default(17),
});

/**
 * Las imágenes ya pedidas, en el proceso.
 *
 * El pin de una propiedad no se mueve, así que la misma estampa se pide una vez
 * por cada persona que abre esa visita. Vive en memoria y se pierde al
 * reiniciar: es una caché, y lo peor que pasa es pagarle a Google una consulta
 * más.
 */
const cache = new Map<string, { bytes: ArrayBuffer; tipo: string }>();
const TOPE_CACHE = 200;

export async function GET(request: Request) {
  const userOrResponse = await requireMobileUser(request);
  if (!isMobileUser(userOrResponse)) return userOrResponse;

  const clave = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!clave) {
    return NextResponse.json(
      { error: "El mapa no está configurado en el servidor." },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const parsed = consulta.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { lat, lng, ancho, alto, zoom } = parsed.data;

  const punto = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const cacheKey = `${punto}|${ancho}x${alto}|${zoom}`;
  const guardada = cache.get(cacheKey);
  if (guardada) return imagen(guardada.bytes, guardada.tipo);

  const pedido = new URL("https://maps.googleapis.com/maps/api/staticmap");
  pedido.searchParams.set("center", punto);
  pedido.searchParams.set("zoom", String(zoom));
  pedido.searchParams.set("size", `${ancho}x${alto}`);
  // Retina: la ficha se mira en un teléfono, y al doble se ven los techos.
  pedido.searchParams.set("scale", "2");
  // Satélite con etiquetas, igual que el mapa del portal: adentro de una
  // urbanización el callejero no dice nada y el techo con su jardín sí.
  pedido.searchParams.set("maptype", "hybrid");
  pedido.searchParams.set("format", "jpg");
  pedido.searchParams.set("language", "es");
  pedido.searchParams.set("region", "ec");
  pedido.searchParams.set("markers", `color:0x2d7b48|${punto}`);
  pedido.searchParams.set("key", clave);

  let respuesta: Response;
  try {
    respuesta = await fetch(pedido, { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "No pudimos pedir el mapa." }, { status: 502 });
  }

  if (!respuesta.ok) {
    // Google explica el motivo en texto plano —la API sin habilitar, la clave
    // restringida, la facturación—: se registra tal cual, que es lo que
    // permite arreglarlo sin adivinar.
    const detalle = await respuesta.text().catch(() => "");
    console.error(
      `[mapa] Static Maps respondió ${respuesta.status}: ${detalle.slice(0, 300)}`
    );
    return NextResponse.json({ error: "No pudimos armar el mapa." }, { status: 502 });
  }

  const bytes = await respuesta.arrayBuffer();
  const tipo = respuesta.headers.get("content-type") ?? "image/jpeg";
  if (cache.size >= TOPE_CACHE) cache.clear();
  cache.set(cacheKey, { bytes, tipo });

  return imagen(bytes, tipo);
}

function imagen(bytes: ArrayBuffer, tipo: string) {
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": tipo,
      // Un día en el teléfono: el pin de una propiedad no se mueve, y si se
      // corrige, al día siguiente se ve el nuevo.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
