/**
 * Dónde está quien marca, según el navegador.
 *
 * Se pide y **no se exige**: el permiso se puede negar, y aunque se conceda
 * falta señal adentro de una pared o con la batería baja. Bloquear la marca por
 * eso deja a alguien sin poder anotar el trabajo que sí hizo — se pierde el
 * dato real por perseguir uno falso.
 *
 * Y conviene saber lo que esto vale: en el navegador la ubicación **se falsea
 * en tres clics** (las DevTools de Chrome traen un override), así que es
 * evidencia para que la oficina mire, no una cerradura. En la app móvil la
 * lectura es mejor y Android además delata las de mock; acá eso no existe, por
 * eso `simulada` no viaja desde la web.
 *
 * Requiere HTTPS. En `localhost` el navegador lo permite igual, así que en
 * desarrollo funciona sin certificado.
 */
export interface UbicacionDelNavegador {
  lat: number;
  lng: number;
  /** Radio en metros que informa el dispositivo. ±2000 no dice nada. */
  precision: number | null;
}

/** Cuánto esperar antes de marcar sin ubicación. */
const ESPERA_MS = 10_000;

/**
 * Pide la ubicación y devuelve `null` si no la hay, en vez de fallar.
 *
 * Nunca lanza: quien la llama está por marcar una entrada, y que la marca no
 * salga porque el GPS tardó es exactamente lo que no queremos.
 */
export async function ubicacionActual(): Promise<UbicacionDelNavegador | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolver) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolver({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : null,
        }),
      () => resolver(null),
      {
        enableHighAccuracy: true,
        timeout: ESPERA_MS,
        // Una lectura de hace un minuto sirve y evita esperar un arranque de
        // GPS entero; más vieja que eso ya podría ser de otro lado.
        maximumAge: 60_000,
      }
    );
  });
}
