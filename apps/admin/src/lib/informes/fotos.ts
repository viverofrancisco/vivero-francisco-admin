import sharp from "sharp";

/** Los bytes de una foto, listos para meter en el PDF. */
export interface FotoParaPdf {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * El lado más largo de una foto, según para qué es el PDF.
 *
 * Impresa mide como mucho 252 pt de ancho (dos por fila). El **borrador** con
 * 520 px la cubre de sobra en pantalla; el **definitivo** va a 1200 px, que a
 * ese tamaño impreso son más de 300 ppp — o sea, todo lo que se puede ver en
 * papel.
 *
 * Las cámaras dan 3164 px y meterlos enteros dejaba informes de 13 MB, que es
 * un archivo que cuesta mandar por mail o WhatsApp. **El corte de páginas no
 * cambia** en ninguno de los dos casos: el layout depende del alto en puntos
 * que declara el estilo, no de cuántos píxeles trae el archivo.
 */
const LADO = { borrador: 520, final: 1200 } as const;

/** Cuánta compresión. El borrador se mira en pantalla y no se archiva. */
const CALIDAD = { borrador: 70, final: 82 } as const;

/**
 * Fotos que ya se bajaron, guardadas **achicadas**.
 *
 * Solo para el borrador: el informe definitivo siempre baja el original, porque
 * es el que se archiva y se le manda al cliente. Acá lo que importa es que
 * mirar una vista previa mientras se editan las secciones no vuelva a bajar 33
 * MB de R2 cada vez.
 *
 * Vive en el proceso, así que se pierde al reiniciar y no se comparte entre
 * instancias. Está bien: es una caché, y lo peor que pasa es que la primera
 * previa de cada instancia tarde lo que tardaba antes.
 */
const cacheBorrador = new Map<string, FotoParaPdf>();
const TOPE_CACHE = 400;

/**
 * Baja las fotos que falten, **en paralelo**.
 *
 * De a una tardaba 3,1 s para once fotos, y ese era el grueso del tiempo de
 * armar un informe. Con un tope de simultáneas para no abrir cien conexiones a
 * R2 de golpe.
 */
export async function bajarFotos(
  fotos: { key: string; url: string }[],
  opciones: { borrador: boolean }
): Promise<Map<string, FotoParaPdf>> {
  const resultado = new Map<string, FotoParaPdf>();
  const faltan: { key: string; url: string }[] = [];

  for (const f of fotos) {
    if (resultado.has(f.key)) continue;
    const cacheada = opciones.borrador ? cacheBorrador.get(f.key) : undefined;
    if (cacheada) resultado.set(f.key, cacheada);
    else if (!faltan.some((x) => x.key === f.key)) faltan.push(f);
  }

  const EN_PARALELO = 6;
  for (let i = 0; i < faltan.length; i += EN_PARALELO) {
    const tanda = faltan.slice(i, i + EN_PARALELO);
    const bajadas = await Promise.all(
      tanda.map(async (f) => {
        const res = await fetch(f.url);
        if (!res.ok) {
          throw new Error(`No pudimos descargar la foto ${f.key}.`);
        }
        const mimeType = res.headers.get("content-type") ?? "image/jpeg";
        const bytes = new Uint8Array(await res.arrayBuffer());
        // Las dos calidades se achican; lo que cambia es cuánto.
        const modo = opciones.borrador ? "borrador" : "final";
        return { key: f.key, foto: await achicar(bytes, mimeType, modo) };
      })
    );
    for (const { key, foto } of bajadas) {
      resultado.set(key, foto);
      if (opciones.borrador) guardar(key, foto);
    }
  }

  return resultado;
}

/**
 * La deja en `LADO[modo]` de lado mayor y la pasa a JPEG.
 *
 * Sale siempre JPEG y el `mimeType` lo dice: react-pdf usa lo que se le declara
 * para decidir cómo decodificar, y decirle "png" mandándole JPEG imprime
 * "Incomplete or corrupt PNG file" y deja la foto en blanco. Pasó.
 *
 * Si sharp no puede con el archivo, se devuelve el original: un informe con la
 * foto pesada es mejor que uno sin la foto, que además cambiaría el corte de
 * páginas.
 */
async function achicar(
  bytes: Uint8Array,
  mimeType: string,
  modo: "borrador" | "final"
): Promise<FotoParaPdf> {
  try {
    const salida = await sharp(Buffer.from(bytes))
      .rotate()
      .resize(LADO[modo], LADO[modo], {
        fit: "inside",
        withoutEnlargement: true,
      })
      // Un PNG con transparencia pasa a JPEG, que no la tiene: sin aplanar
      // contra blanco, sharp la rellena de negro y la previa muestra un
      // manchón donde el informe definitivo no lo tiene.
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: CALIDAD[modo] })
      .toBuffer();
    return { bytes: new Uint8Array(salida), mimeType: "image/jpeg" };
  } catch {
    return { bytes, mimeType };
  }
}

function guardar(key: string, foto: FotoParaPdf) {
  cacheBorrador.set(key, foto);
  // `Map` conserva el orden de inserción, así que el primero es el más viejo.
  while (cacheBorrador.size > TOPE_CACHE) {
    const masViejo = cacheBorrador.keys().next().value;
    if (masViejo === undefined) break;
    cacheBorrador.delete(masViejo);
  }
}

/**
 * El logo de la empresa, cacheado por URL.
 *
 * Es el mismo archivo en todos los informes y se bajaba de nuevo en cada uno.
 * En una previa que se refresca sola, eso era medio segundo por tecla.
 */
const cacheLogo = new Map<string, { bytes: Uint8Array; format: "png" | "jpg" }>();

export async function bajarLogo(
  url: string
): Promise<{ bytes: Uint8Array; format: "png" | "jpg" } | null> {
  const cacheado = cacheLogo.get(url);
  if (cacheado) return cacheado;

  const res = await fetch(url);
  if (!res.ok) {
    // Sin esto el informe sale sin logo ni marca de agua y nadie se entera: la
    // falta de logo no rompe nada, y el PDF se ve "bien" hasta que alguien lo
    // compara con uno viejo. Pasó cuando el logo quedó apuntando a un bucket
    // que ya no existía.
    console.warn(
      `Logo de la empresa: ${res.status} al bajar ${url}. El informe sale sin ` +
        `logo; volvé a subirlo en Configuración → Empresa.`
    );
    return null;
  }
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const logo = {
    bytes: new Uint8Array(await res.arrayBuffer()),
    format: (ct.includes("png") ? "png" : "jpg") as "png" | "jpg",
  };
  // No se vacía nunca porque son uno o dos: la empresa tiene un logo.
  cacheLogo.set(url, logo);
  return logo;
}
