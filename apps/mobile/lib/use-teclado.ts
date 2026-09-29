import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, useWindowDimensions } from "react-native";

/**
 * Cuánto del piso de la pantalla ocupa el teclado, en puntos.
 *
 * Es para lo que `KeyboardAvoidingView` no resuelve: una hoja de abajo
 * (`HojaInferior`), un `pageSheet` o un diálogo, que son ventanas propias y
 * no se encogen con el teclado; el buscador quedaba visible y los resultados
 * detrás del teclado.
 *
 * En iOS escucha `keyboardWillChangeFrame`, que cubre abrir, cerrar, cambiar
 * de teclado y la barrita del teclado físico —`screenY` es dónde empieza el
 * teclado, y al cerrarse queda en el borde y da cero—. En Android,
 * `keyboardDidShow`/`Hide`: con la app de borde a borde (`edgeToEdgeEnabled`)
 * el sistema **ya no achica la ventana** con el teclado, así que hay que
 * correr las cosas a mano igual que en iOS. Si alguna versión sí la achica,
 * la ventana se mide más baja y eso se descuenta, para no correr dos veces.
 */
export function useAltoDelTeclado(): number {
  const { height } = useWindowDimensions();
  const [teclado, setTeclado] = useState(0);
  /** El alto de la ventana con el teclado cerrado, para saber si la achicó. */
  const altoSinTeclado = useRef(height);
  if (teclado === 0) altoSinTeclado.current = height;

  useEffect(() => {
    if (Platform.OS === "ios") {
      const sub = Keyboard.addListener("keyboardWillChangeFrame", (e) => {
        setTeclado(Math.max(0, Math.round(height - e.endCoordinates.screenY)));
      });
      return () => sub.remove();
    }
    const abre = Keyboard.addListener("keyboardDidShow", (e) => {
      setTeclado(Math.round(e.endCoordinates.height));
    });
    const cierra = Keyboard.addListener("keyboardDidHide", () => setTeclado(0));
    return () => {
      abre.remove();
      cierra.remove();
    };
  }, [height]);

  if (Platform.OS === "ios") return teclado;
  const achicada = Math.max(0, altoSinTeclado.current - height);
  return Math.max(0, teclado - achicada);
}
