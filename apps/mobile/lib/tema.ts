import { cubicBezier } from "react-native-reanimated";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * Los colores de la app, en un solo lugar.
 *
 * `#2e7d32` estaba escrito a mano **58 veces en 24 archivos**, y el tema de
 * react-native-paper que lo define en `app/_layout.tsx` no lo leía nadie:
 * `useTheme()` no se llamaba ni una vez. Cambiar el verde de la marca era
 * buscar y reemplazar.
 *
 * Los grises de presión eran siete tonos distintos —`#eaeaea`, `#f5f5f5`,
 * `#e3f1e4`, `#f0f0f0`, `#f2f2f2`…— que nadie eligió: cada pantalla inventó el
 * suyo. Acá son dos.
 */
export const tema = {
  /** El verde de la marca. El mismo que el `primary` de Paper. */
  verde: "#2e7d32",
  verdeSuave: "#f4faf4",
  verdeBorde: "#c3dfc5",
  verdeTocado: "#e3f1e4",

  texto: "#111",
  textoSuave: "#666",
  textoTenue: "#888",

  fondo: "#fff",
  superficie: "#fafafa",
  superficieTocada: "#f0f0f0",
  borde: "#e6e6e6",

  error: "#b3261e",
  aviso: "#e0a800",
  avisoTexto: "#8a6d00",
} as const;

/**
 * Las curvas y duraciones del movimiento.
 *
 * Las incorporadas —las de CSS y las siete palabras que acepta Reanimated— son
 * demasiado débiles para movimiento deliberado: arrancan lento justo en el
 * momento que el ojo está mirando.
 *
 * `easeOut` es una **función**, no la cadena `"cubic-bezier(...)"`. Las
 * transiciones CSS de Reanimated solo aceptan las palabras predefinidas o el
 * resultado de `cubicBezier()`; pasarle la cadena revienta en tiempo de
 * ejecución con "Invalid predefined timing function", que es exactamente lo que
 * pasó.
 */
export const movimiento = {
  /** Feedback de presión. 120 ms y 3% es el techo para algo que se toca todo el día. */
  presion: { duracion: 120, escala: 0.97 },
  /** Curva fuerte de salida, para entradas y salidas. */
  easeOut: cubicBezier(0.23, 1, 0.32, 1),
} as const;

/**
 * Una transición CSS de Reanimated, lista para poner en un `Animated.View`.
 *
 * El `as` no es pereza. React Native 0.81 declara `transitionTimingFunction` en
 * su propio `ViewStyle` —sus transiciones CSS experimentales— con un tipo
 * distinto al de Reanimated, y la unión del prop `style` resuelve al de RN, que
 * no acepta el objeto que devuelve `cubicBezier()`.
 *
 * El runtime sí lo acepta: `normalizeTimingFunction` toma una de las siete
 * palabras predefinidas **o** cualquier objeto con `.normalize()`, que es
 * exactamente lo que `cubicBezier()` devuelve
 * (`css/native/normalization/common/settings.js`). Lo que está mal es el
 * `.d.ts`, no el valor.
 */
export function transicion(
  propiedad: string,
  duracionMs: number,
  extra?: ViewStyle
): StyleProp<ViewStyle> {
  return {
    ...extra,
    transitionProperty: propiedad,
    transitionDuration: `${duracionMs}ms`,
    transitionTimingFunction: movimiento.easeOut,
  } as unknown as StyleProp<ViewStyle>;
}
