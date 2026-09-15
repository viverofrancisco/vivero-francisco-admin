import * as Location from "expo-location";

/**
 * Dónde está quien marca.
 *
 * **El permiso negado bloquea; el GPS que no engancha, no.** Son dos fallas
 * distintas y tratarlas igual castiga a la persona equivocada:
 *
 * - Negar el permiso es una decisión, y se revierte desde Ajustes. Dejar marcar
 *   igual convierte el control en un pedido amable que se saltea en dos toques.
 * - Que no haya señal no es decisión de nadie: pasa adentro de una pared, en un
 *   patio techado, con la batería en ahorro. Bloquear ahí deja a alguien sin
 *   poder registrar el trabajo que sí hizo, y se pierde el dato real —cuándo
 *   estuvo, qué hizo— por perseguir uno que de todos modos se puede falsear.
 *
 * Y conviene saber lo que esto vale. En Android una app de mock puede inventar
 * la posición, y eso se delata (`mocked`); en iOS hace falta una computadora
 * conectada o un jailbreak. Es evidencia para que la oficina mire, no una
 * cerradura.
 */
export interface UbicacionMarcada {
  lat: number;
  lng: number;
  /** Radio en metros que informa el dispositivo. ±2000 no dice nada. */
  precision: number | null;
  /** Android delata una ubicación de mock. iOS no: ahí es `null`. */
  simulada: boolean | null;
}

export type ResultadoUbicacion =
  | { estado: "ok"; ubicacion: UbicacionMarcada }
  /** Dio permiso, pero no hubo posición. Se marca igual. */
  | { estado: "sin-senal" }
  /** No dio permiso. `ajustes` = iOS ya no vuelve a preguntar desde la app. */
  | { estado: "sin-permiso"; ajustes: boolean };

/** Cuánto esperar una posición antes de darla por perdida. */
const ESPERA_MS = 10_000;

export async function ubicacionActual(): Promise<ResultadoUbicacion> {
  let permiso: Location.LocationPermissionResponse;
  try {
    permiso = await Location.requestForegroundPermissionsAsync();
  } catch {
    return { estado: "sin-permiso", ajustes: true };
  }

  if (permiso.status !== Location.PermissionStatus.GRANTED) {
    // `canAskAgain: false` es iOS después de un "No permitir": el diálogo del
    // sistema no vuelve a salir, así que el único camino es Ajustes.
    return { estado: "sin-permiso", ajustes: !permiso.canAskAgain };
  }

  try {
    // `Promise.race` con un tiempo propio: `getCurrentPositionAsync` puede
    // quedarse esperando un arranque de GPS adentro de una casa, y el botón
    // tiene que responder.
    const posicion = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), ESPERA_MS)),
    ]);
    if (!posicion) return { estado: "sin-senal" };

    return {
      estado: "ok",
      ubicacion: {
        lat: posicion.coords.latitude,
        lng: posicion.coords.longitude,
        precision: Number.isFinite(posicion.coords.accuracy ?? NaN)
          ? (posicion.coords.accuracy as number)
          : null,
        simulada: typeof posicion.mocked === "boolean" ? posicion.mocked : null,
      },
    };
  } catch {
    return { estado: "sin-senal" };
  }
}
