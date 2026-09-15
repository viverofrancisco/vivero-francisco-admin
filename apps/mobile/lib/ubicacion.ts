import * as Location from "expo-location";

/**
 * Dónde está quien marca.
 *
 * Se pide y **no se exige**: el permiso se puede negar, y aunque se conceda
 * falta señal adentro de una pared, con la batería baja o con el teléfono en la
 * camioneta. Bloquear la marca por eso deja a alguien sin poder anotar el
 * trabajo que sí hizo — se pierde el dato real por perseguir uno falso. La
 * oficina ve cuáles marcas vinieron sin ubicación, que es la pregunta que se
 * quería responder.
 *
 * Acá la lectura es bastante mejor que en el navegador, y Android además
 * delata las ubicaciones de una app de mock (`mocked`). iOS no lo informa: ahí
 * queda `null`, que significa "no sabemos", no "no simulada".
 */
export interface UbicacionMarcada {
  lat: number;
  lng: number;
  precision: number | null;
  simulada: boolean | null;
}

/** Cuánto esperar antes de marcar sin ubicación. */
const ESPERA_MS = 10_000;

/**
 * Pide permiso y lee la posición. Devuelve `null` en vez de fallar.
 *
 * Nunca lanza: quien la llama está por marcar una entrada, y que la marca no
 * salga porque el GPS tardó es exactamente lo que no queremos.
 */
export async function ubicacionActual(): Promise<UbicacionMarcada | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;

    // `Promise.race` con un tiempo propio: `getCurrentPositionAsync` puede
    // quedarse esperando un arranque de GPS adentro de una casa, y el botón
    // tiene que responder.
    const posicion = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((r) => setTimeout(() => r(null), ESPERA_MS)),
    ]);
    if (!posicion) return null;

    return {
      lat: posicion.coords.latitude,
      lng: posicion.coords.longitude,
      precision: Number.isFinite(posicion.coords.accuracy ?? NaN)
        ? (posicion.coords.accuracy as number)
        : null,
      // Solo Android lo informa.
      simulada: typeof posicion.mocked === "boolean" ? posicion.mocked : null,
    };
  } catch {
    return null;
  }
}
