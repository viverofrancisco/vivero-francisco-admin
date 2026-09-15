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
 * Las de CSS y las de Reanimated son demasiado débiles para movimiento
 * deliberado: arrancan lento justo en el momento que el ojo está mirando.
 */
export const movimiento = {
  /** Feedback de presión. 120 ms y 3% es el techo para algo que se toca todo el día. */
  presion: { duracion: 120, escala: 0.97 },
  /** Curva fuerte de salida, para entradas y salidas. */
  easeOut: "cubic-bezier(0.23, 1, 0.32, 1)",
} as const;
