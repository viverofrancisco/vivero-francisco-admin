import { cubicBezier } from "react-native-reanimated";
import type { StyleProp, ViewStyle } from "react-native";

/**
 * Los tokens del sistema de diseño, traducidos a React Native.
 *
 * Vienen del proyecto de Claude Design ("Vivero Francisco"), donde están
 * escritos en `oklch`. React Native no entiende ese espacio de color, así que
 * acá están convertidos a hexadecimal una sola vez, en vez de que cada pantalla
 * invente su aproximación.
 *
 * El verde de la marca cambió: era `#2e7d32` —el verde de Material que trajo la
 * plantilla— y ahora es el del sistema. Estaba escrito a mano **58 veces en 24
 * archivos**, y el tema de react-native-paper que lo definía no lo leía nadie.
 */
export const tema = {
  /** El verde de la marca. */
  verde: "#2d7b48",
  /** Para gradientes y superficies oscuras. */
  verdeProfundo: "#1b3e29",
  /** Texto e iconos sobre fondos claros de marca. */
  verde700: "#196237",
  verde600: "#267543",
  /** Bordes y rellenos suaves. */
  verde100: "#d8efdc",
  verde50: "#ebf7ed",

  /** Los tres niveles de texto. Nunca un gris que no esté acá. */
  texto: "#1e231f",
  texto2: "#535a55",
  texto3: "#7c827d",

  /** Bordes: `linea` para separar tarjetas, `linea2` para filas internas. */
  linea: "#dce1dd",
  linea2: "#ecf0ec",

  /** El fondo de la app tiene un verde casi imperceptible, no es blanco puro. */
  fondo: "#f8fbf7",
  lienzo: "#f1f5f0",
  superficie: "#ffffff",

  ambar: "#d78b35",
  ambar50: "#feedd7",
  ambarTexto: "#974d00",
  rojo: "#c8393a",
  rojo50: "#ffeae8",
  arcilla: "#c37144",
  cielo: "#49829f",
  cielo50: "#e4f3fc",
} as const;

/**
 * Cómo se ve cada estado de una visita.
 *
 * Un solo lugar: estaba copiado en cuatro pantallas y ninguna contemplaba
 * `EN_CURSO`, que existe desde que cada jardinero carga su parte.
 */
export const estadoVisual: Record<
  string,
  { etiqueta: string; color: string; fondo: string; punto: string }
> = {
  PROGRAMADA: { etiqueta: "Programada", color: tema.verde, fondo: tema.verde50, punto: tema.verde },
  EN_CURSO: { etiqueta: "En curso", color: tema.cielo, fondo: tema.cielo50, punto: tema.cielo },
  COMPLETADA: { etiqueta: "Completada", color: tema.texto2, fondo: tema.linea2, punto: tema.texto3 },
  INCOMPLETA: { etiqueta: "Incompleta", color: tema.ambarTexto, fondo: tema.ambar50, punto: tema.ambar },
  CANCELADA: { etiqueta: "Cancelada", color: tema.rojo, fondo: tema.rojo50, punto: tema.rojo },
};

/** La tarjeta del sistema: blanca, borde fino, sombra de un píxel. */
export const tarjeta = {
  backgroundColor: tema.superficie,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: tema.linea,
  shadowColor: "#142819",
  shadowOpacity: 0.04,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;

/**
 * Las curvas y duraciones del movimiento.
 *
 * Las incorporadas —las de CSS y las siete palabras que acepta Reanimated— son
 * demasiado débiles para movimiento deliberado: arrancan lento justo en el
 * momento que el ojo está mirando.
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
