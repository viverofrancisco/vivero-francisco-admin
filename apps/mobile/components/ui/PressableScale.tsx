import { useState } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { movimiento, transicion } from "@/lib/tema";

/**
 * Un `Pressable` que se hunde al tocarlo.
 *
 * En el teléfono no hay hover: todo lo que en la web vive en el puntero tiene
 * que vivir en la presión. Acá no vivía en ningún lado — los 29 `Pressable` de
 * la app cambiaban de color y nada más, y el color no se ve cuando el dedo está
 * encima tapándolo.
 *
 * `scale` sí, porque arrastra la etiqueta y los iconos con ella, que es lo que
 * lo hace leer como algo físico. 3% y 120 ms es el techo para algo que un
 * jardinero toca cientos de veces por día: más grande o más lento deja de ser
 * feedback y pasa a ser una animación que hay que esperar.
 *
 * Es una transición CSS de Reanimated y no un valor compartido: son dos estados
 * y dos renders por toque, no uno por cuadro. Un worklet acá sería instalar una
 * librería de física para un fundido.
 */
export function PressableScale({
  children,
  style,
  estiloExterno,
  estiloPresionado,
  ...props
}: Omit<PressableProps, "children" | "style"> & {
  /** Sin la forma de función de `Pressable`: el estado presionado lo lleva esto. */
  children?: React.ReactNode;
  /** El aspecto: fondo, borde, padding. Va en la vista que se encoge. */
  style?: StyleProp<ViewStyle>;
  /**
   * Lo que decide el **espacio** que ocupa: `flex`, `alignSelf`, `width`.
   *
   * Va en el `Pressable` de afuera y no en la vista que se encoge, porque el
   * hijo de un flex es el `Pressable`: un `flex: 1` puesto adentro no reparte
   * nada y el elemento colapsa a su contenido. Es lo que descentró el título
   * de la fecha —la vista interna se estiraba, el `Pressable` no—.
   */
  estiloExterno?: StyleProp<ViewStyle>;
  /** Lo que además cambia al presionar —un fondo, por ejemplo—. */
  estiloPresionado?: StyleProp<ViewStyle>;
}) {
  const [presionado, setPresionado] = useState(false);
  // Movimiento reducido: se queda el cambio de fondo, se va el encogimiento.
  const reducido = useReducedMotion();

  return (
    <Pressable
      // Un dedo que se corre unos píxeles no debería cancelar un toque que la
      // persona sí quiso hacer.
      pressRetentionOffset={16}
      {...props}
      style={estiloExterno}
      onPressIn={(e) => {
        setPresionado(true);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPresionado(false);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View
        style={[
          estiloBase,
          style,
          presionado && !reducido && estiloPresion,
          presionado && estiloPresionado,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const estiloBase = transicion("transform", movimiento.presion.duracion, {
  transform: [{ scale: 1 }],
});
const estiloPresion = { transform: [{ scale: movimiento.presion.escala }] };
