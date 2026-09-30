import { Alert, Linking, Platform } from "react-native";
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

/**
 * Por qué no hay ubicación cuando es una decisión de la persona.
 *
 * `ajustes` = el sistema ya no va a preguntar desde la app (iOS después de un
 * "No permitir"; siempre, con el servicio apagado), así que el único camino es
 * Ajustes. `apagada` = el permiso está dado pero **la ubicación del teléfono**,
 * el interruptor general, está apagada.
 */
export interface FaltaDeUbicacion {
  ajustes: boolean;
  apagada: boolean;
}

export type ResultadoUbicacion =
  | { estado: "ok"; ubicacion: UbicacionMarcada }
  /** Dio permiso y está encendida, pero no hubo posición. Se marca igual. */
  | { estado: "sin-senal" }
  /** No dio permiso, o tiene la ubicación del teléfono apagada. */
  | ({ estado: "sin-permiso" } & FaltaDeUbicacion);

/** Cuánto esperar una posición antes de darla por perdida. */
const ESPERA_MS = 10_000;

/**
 * Hasta qué edad vale la última posición que el teléfono ya tenía. Quien llega
 * manejando con Waze abierto tiene una de hace segundos, y hace un minuto
 * estaba ahí o a unas cuadras; más viejo que eso ya no dice dónde marcó.
 */
const EDAD_MAXIMA_ULTIMA_MS = 60_000;

function marcada(posicion: Location.LocationObject): UbicacionMarcada {
  return {
    lat: posicion.coords.latitude,
    lng: posicion.coords.longitude,
    precision: Number.isFinite(posicion.coords.accuracy ?? NaN)
      ? (posicion.coords.accuracy as number)
      : null,
    simulada: typeof posicion.mocked === "boolean" ? posicion.mocked : null,
  };
}

export async function ubicacionActual(): Promise<ResultadoUbicacion> {
  let permiso: Location.LocationPermissionResponse;
  try {
    permiso = await Location.requestForegroundPermissionsAsync();
  } catch {
    return { estado: "sin-permiso", ajustes: true, apagada: false };
  }

  if (permiso.status !== Location.PermissionStatus.GRANTED) {
    // `canAskAgain: false` es iOS después de un "No permitir": el diálogo del
    // sistema no vuelve a salir, así que el único camino es Ajustes.
    return { estado: "sin-permiso", ajustes: !permiso.canAskAgain, apagada: false };
  }

  // La ubicación del teléfono apagada —el interruptor general, no el permiso—
  // es la misma decisión que negar el permiso, y se exige igual. Antes caía
  // como "sin señal" (el sistema devuelve error) y se marcaba en blanco: la
  // forma más fácil de marcar sin decir dónde.
  if (!(await encenderUbicacion())) {
    return { estado: "sin-permiso", ajustes: true, apagada: true };
  }

  try {
    // `Promise.race` con un tiempo propio: `getCurrentPositionAsync` puede
    // quedarse esperando un arranque de GPS adentro de una casa, y el botón
    // tiene que responder.
    const posicion = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), ESPERA_MS)),
    ]);
    if (posicion) return { estado: "ok", ubicacion: marcada(posicion) };
  } catch {
    // Sin posición nueva: se prueba con la última, abajo.
  }

  // Sin posición nueva en ese tiempo —el arranque frío del GPS en una quinta
  // sin WiFi tarda medio minuto— vale la última que el teléfono ya tenía, si
  // es reciente. Con eso el caso común deja de producir marcas en blanco.
  const ultima = await Location.getLastKnownPositionAsync({
    maxAge: EDAD_MAXIMA_ULTIMA_MS,
  }).catch(() => null);
  if (ultima) return { estado: "ok", ubicacion: marcada(ultima) };

  return { estado: "sin-senal" };
}

/**
 * Si la ubicación del teléfono está encendida; y si no, en Android, el diálogo
 * del sistema para encenderla ahí mismo ("¿Activar la ubicación?"), que
 * resuelve cuando la persona acepta. iOS no tiene ese diálogo: ahí es Ajustes.
 * Cuando no se puede saber, se da por encendida y que la posición decida.
 */
export async function encenderUbicacion(): Promise<boolean> {
  try {
    if (await Location.hasServicesEnabledAsync()) return true;
  } catch {
    return true;
  }
  if (Platform.OS !== "android") return false;
  try {
    await Location.enableNetworkProviderAsync();
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

/**
 * El aviso de que falta la ubicación, uno solo.
 *
 * Estaba escrito en la entrada y en la salida, con dos textos parecidos: dos
 * copias de un cartel son dos carteles que se despegan.
 *
 * Con el permiso negado, `Linking.openSettings()` abre la página de **esta**
 * app —no la raíz de Ajustes—, que es donde está el interruptor de Ubicación:
 * un toque acá, otro allá y listo. Con la ubicación del teléfono apagada el
 * interruptor está en otra parte: en Android se abre esa pantalla directo (el
 * intent de ubicación); en iOS no hay forma de abrirla desde una app, así que
 * el cartel dice el camino.
 */
export function avisarFaltaUbicacion(motivo: string, falta: FaltaDeUbicacion) {
  if (falta.apagada) {
    const camino =
      Platform.OS === "android"
        ? "Enciéndela en Ajustes."
        : "Enciéndela en Ajustes › Privacidad y seguridad › Localización.";
    Alert.alert("La ubicación del teléfono está apagada", `${motivo} ${camino}`, [
      { text: "Ahora no", style: "cancel" },
      { text: "Abrir Ajustes", onPress: abrirAjustesDeUbicacion },
    ]);
    return;
  }
  Alert.alert(
    "Falta la ubicación",
    falta.ajustes ? `${motivo} Actívala en Ajustes.` : motivo,
    falta.ajustes
      ? [
          { text: "Ahora no", style: "cancel" },
          { text: "Abrir Ajustes", onPress: () => Linking.openSettings() },
        ]
      : [{ text: "Entendido" }]
  );
}

function abrirAjustesDeUbicacion() {
  if (Platform.OS === "android") {
    Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS").catch(() =>
      Linking.openSettings()
    );
  } else {
    Linking.openSettings();
  }
}

/**
 * Si ya lo dio, sin pedir nada. Para preguntar antes de necesitarlo.
 *
 * `ajustes` dice que el sistema ya no vuelve a mostrar su diálogo, que es
 * cuando el único camino es Ajustes.
 */
export async function permisoDeUbicacion(): Promise<{
  concedido: boolean;
  puedePreguntar: boolean;
  ajustes: boolean;
  /** El interruptor general del teléfono, aparte del permiso. */
  encendida: boolean;
}> {
  const encendida = await Location.hasServicesEnabledAsync().catch(() => true);
  try {
    const permiso = await Location.getForegroundPermissionsAsync();
    return {
      concedido: permiso.granted,
      puedePreguntar: permiso.canAskAgain,
      ajustes: !permiso.canAskAgain,
      encendida,
    };
  } catch {
    return { concedido: false, puedePreguntar: false, ajustes: true, encendida };
  }
}

/** Muestra el diálogo del sistema. Devuelve si quedó concedido. */
export async function pedirPermisoDeUbicacion(): Promise<boolean> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    return permiso.granted;
  } catch {
    return false;
  }
}
