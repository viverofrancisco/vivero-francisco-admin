import { useEffect, useState } from "react";
import { Keyboard, Platform, useWindowDimensions } from "react-native";

/**
 * Cuánto del piso de la pantalla ocupa el teclado, en puntos. Solo iOS: en
 * Android la ventana se achica sola con el teclado (`adjustResize`) y sumar
 * esto la correría dos veces.
 *
 * Es para lo que `KeyboardAvoidingView` no resuelve: una hoja de abajo
 * (`HojaInferior`), un `pageSheet` o un diálogo, que son ventanas propias y
 * no se encogen con el teclado; el buscador quedaba visible y los resultados
 * detrás del teclado. Escucha `keyboardWillChangeFrame`, que cubre abrir,
 * cerrar, cambiar de teclado y la barrita del teclado físico —`screenY` es
 * dónde empieza el teclado, y al cerrarse queda en el borde y da cero—.
 */
export function useAltoDelTeclado(): number {
  const { height } = useWindowDimensions();
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = Keyboard.addListener("keyboardWillChangeFrame", (e) => {
      setAlto(Math.max(0, Math.round(height - e.endCoordinates.screenY)));
    });
    return () => sub.remove();
  }, [height]);
  return alto;
}
