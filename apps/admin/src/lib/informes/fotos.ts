import sharp from "sharp";
import type { FotosPorFila } from "./template-data";

/** Los bytes de una foto, listos para meter en el PDF. */
export interface FotoParaPdf {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * El lado más largo de una foto en el PDF definitivo, **según cuántas van por
 * fila**.
 *
 * Lo que hace falta sale del tamaño impreso, no de un número parejo: con dos
 * por fila la caja mide 252 × 190 pt (3,5 pulgadas de ancho), con tres 165 ×
 * 130 y con cuatro 121 × 100. A unos 350 ppp —bastante por encima de los 300
 * de imprenta— eso da 1200, 800 y 600 px. Mandar 1200 para las tres es pagar
 * cuatro veces los píxeles que la de cuatro por fila puede mostrar.
 *
 * Las cámaras dan 3164 px y meterlos enteros dejaba informes de 13 MB, que es
 * un archivo que cuesta mandar por mail o WhatsApp. **El corte de páginas no
 * cambia** con nada de esto: el layout depende del alto en puntos que declara
 * el estilo, no de cuántos píxeles trae el archivo.
 */
export const LADO_FINAL: Record<FotosPorFila, number> = {
  2: 1200,
  3: 800,
  4: 600,
};

/**
 * El borrador va parejo a 520 px: se mira en pantalla, a media escala, y la
 * caché lo guarda por `key` —sin el tamaño— así que una sola medida evita que
 * la misma foto se guarde dos veces según en qué sección esté.
 */
const LADO_BORRADOR = 520;

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
  /** `lado` es lo que la foto necesita medir en el PDF definitivo. */
  fotos: { key: string; url: string; lado?: number }[],
  opciones: { borrador: boolean }
): Promise<Map<string, FotoParaPdf>> {
  const resultado = new Map<string, FotoParaPdf>();
  const faltan: { key: string; url: string; lado: number }[] = [];

  for (const f of fotos) {
    if (resultado.has(f.key)) continue;
    const cacheada = opciones.borrador ? cacheBorrador.get(f.key) : undefined;
    if (cacheada) {
      resultado.set(f.key, cacheada);
      continue;
    }
    const lado = f.lado ?? LADO_FINAL[2];
    const ya = faltan.find((x) => x.key === f.key);
    /**
     * La misma foto puede estar en dos secciones con densidades distintas: se
     * baja una sola vez, y al tamaño de **la más grande**.
     *
     * Y no una versión por sección, que sería lo obvio: react-pdf reusa la
     * imagen cuando los bytes son los mismos —la incrusta una vez y la
     * referencia dos— así que darle dos tamaños son dos imágenes incrustadas.
     * Medido: compartida a 1200 px son 86 KB, y 1200 + 600 son 115.
     */
    if (ya) ya.lado = Math.max(ya.lado, lado);
    else faltan.push({ ...f, lado });
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
        const lado = opciones.borrador ? LADO_BORRADOR : f.lado;
        return { key: f.key, foto: await achicar(bytes, mimeType, modo, lado) };
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
 * La deja en `lado` px de lado mayor y la pasa a JPEG.
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
  modo: "borrador" | "final",
  lado: number
): Promise<FotoParaPdf> {
  try {
    const salida = await sharp(Buffer.from(bytes))
      .rotate()
      .resize(lado, lado, {
        fit: "inside",
        withoutEnlargement: true,
      })
      // Un PNG con transparencia pasa a JPEG, que no la tiene: sin aplanar
      // contra blanco, sharp la rellena de negro y la previa muestra un
      // manchón donde el informe definitivo no lo tiene.
      .flatten({ background: "#ffffff" })
      // `mozjpeg` solo en el definitivo: es el mismo q82 codificado mejor
      // —18% menos de peso sin que la foto cambie—, pero tarda más, y el
      // borrador existe para que la vista previa refresque rápido.
      .jpeg({ quality: CALIDAD[modo], mozjpeg: modo === "final" })
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
