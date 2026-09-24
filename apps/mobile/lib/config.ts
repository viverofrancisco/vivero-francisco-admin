import Constants from "expo-constants";

/**
 * El puerto donde corre el portal, que es quien sirve `/api/mobile/*`.
 *
 * 3000 salvo que `EXPO_PUBLIC_API_PORT` diga otro. Y en desarrollo, si en ese
 * puerto contesta otra cosa, se prueban los siguientes (ver `resolverServidor`):
 * en una máquina con varios proyectos Next el primero que arranca se queda con
 * el 3000, y el portal termina en el 3001 sin que nadie lo elija.
 */
const PUERTO_ADMIN = Number(process.env.EXPO_PUBLIC_API_PORT) || 3000;
const PUERTOS_A_PROBAR = [PUERTO_ADMIN, 3000, 3001, 3002, 3003];

/**
 * Dónde está el servidor.
 *
 * **En desarrollo lo deduce de Metro, y esa es toda la gracia.** La dirección
 * era una IP escrita a mano en `.env`, y el router reparte otra cada tanto: la
 * app quedaba apuntando a un lugar donde no contesta nadie, y eso no se ve como
 * un error de red sino como un botón que no hace nada. Pasó tres veces en un
 * día. Metro ya sabe la IP correcta —es la misma máquina y la app está
 * conectada a ella ahora mismo— así que se le pregunta a él y se cambia el
 * puerto: si el teléfono llegó hasta acá, llega al portal.
 *
 * Sirve igual en el simulador y en un teléfono de verdad en la misma Wi-Fi, que
 * es justo donde la IP escrita a mano se volvía obligatoria.
 *
 * `EXPO_PUBLIC_API_BASE_URL` sigue mandando **en producción** —ahí no hay
 * Metro— y en desarrollo queda como escape para apuntar a otro servidor a
 * propósito: un staging, la máquina de otra persona. No hace falta para la
 * dirección de esta red.
 */
function hostDeMetro(): string | null {
  // `hostUri` viene como "192.168.1.23:8081". En algunas versiones el dato vive
  // en `expoGoConfig.debuggerHost`, así que se miran los dos.
  const crudo =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;
  const host = crudo?.split(":")[0]?.trim();
  if (!host) return null;
  return `http://${host}:${PUERTO_ADMIN}`;
}

const configurada = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

/**
 * Enlace vivo: `resolverServidor` lo puede cambiar al arrancar, y quien lo
 * importa ve el valor nuevo porque un `export let` se lee en cada acceso.
 */
export let API_BASE_URL =
  (__DEV__ ? hostDeMetro() ?? configurada : configurada) ??
  `http://localhost:${PUERTO_ADMIN}`;

/**
 * En desarrollo, encontrar en qué puerto está el portal.
 *
 * Se le pregunta `/api/mobile/ping` al puerto de siempre y, si no contesta
 * `ok` —otro proyecto respondiendo 404, o nadie—, a los siguientes. Con dos
 * o tres Next corriendo en la misma máquina, el portal cae en el 3001 y la
 * app veía "Solicitud falló (404)" al iniciar sesión: el 404 era del otro.
 * En producción no se prueba nada: la dirección está configurada.
 */
export async function resolverServidor(): Promise<string> {
  if (!__DEV__ || configurada) return API_BASE_URL;
  const host = hostDeMetro();
  if (!host) return API_BASE_URL;
  const base = host.replace(/:\d+$/, "");
  for (const puerto of [...new Set(PUERTOS_A_PROBAR)]) {
    try {
      const abortador = new AbortController();
      const reloj = setTimeout(() => abortador.abort(), 1500);
      const res = await fetch(`${base}:${puerto}/api/mobile/ping`, { signal: abortador.signal });
      clearTimeout(reloj);
      if (res.ok && (await res.json().catch(() => null))?.ok === true) {
        API_BASE_URL = `${base}:${puerto}`;
        return API_BASE_URL;
      }
    } catch {
      // Ese puerto no: se sigue con el próximo.
    }
  }
  return API_BASE_URL;
}
