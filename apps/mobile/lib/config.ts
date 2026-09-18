import Constants from "expo-constants";

/** El puerto donde corre el portal, que es quien sirve `/api/mobile/*`. */
const PUERTO_ADMIN = 3000;

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

export const API_BASE_URL =
  (__DEV__ ? hostDeMetro() ?? configurada : configurada) ??
  `http://localhost:${PUERTO_ADMIN}`;
