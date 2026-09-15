import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { tema } from "@/lib/tema";

/**
 * Una hoja que sube desde abajo y **se puede arrastrar para cerrar**.
 *
 * Antes eran `<Modal animationType="slide">` con un agarre dibujado arriba. El
 * agarre mentía: la animación de `Modal` es un tween fijo que no se puede
 * interrumpir, ni revertir a mitad de camino, ni arrastrar. La barrita decía
 * "tirá de mí" y el dedo no encontraba nada.
 *
 * Tres detalles son los que separan esto de un arrastre malo:
 *
 * - **`onStart` guarda dónde está ahora.** Agarrar la hoja mientras todavía se
 *   está acomodando tiene que seguir desde donde el ojo la vio, no teletransportarla.
 * - **Decide la velocidad, no la distancia.** Un envión corto y rápido cierra;
 *   exigir que recorra el 40% la haría sentir pesada. `proyectar()` calcula
 *   dónde habría terminado el dedo si seguía desacelerando.
 * - **La velocidad se le pasa al resorte**, así no hay costura entre el dedo que
 *   suelta y la animación que sigue. Es el detalle que más separa "fluido" de
 *   "correcto".
 *
 * Hacia arriba resiste en vez de frenar en seco: cuanto más se pasa del tope,
 * menos acompaña.
 */

/** Dónde terminaría el dedo si siguiera desacelerando. La forma de Apple. */
function proyectar(velocidad: number, desaceleracion = 0.998) {
  "worklet";
  return ((velocidad / 1000) * desaceleracion) / (1 - desaceleracion);
}

/** Cuanto más se pasa del borde, menos sigue. */
function resistencia(exceso: number, alto: number, k = 0.55) {
  "worklet";
  return (exceso * alto * k) / (alto + k * Math.abs(exceso));
}

export function HojaInferior({
  visible,
  onCerrar,
  children,
  /** Alto máximo como fracción de la pantalla. */
  maxAlto = 0.8,
}: {
  visible: boolean;
  onCerrar: () => void;
  children: React.ReactNode;
  maxAlto?: number;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducido = useReducedMotion();
  const y = useSharedValue(0);
  const desde = useSharedValue(0);
  /** Lo que mide la hoja de verdad, para que el umbral no sea un número inventado. */
  const [alto, setAlto] = useState(height * 0.5);

  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Pide intención antes de tomar el gesto, para no robarle el scroll
        // a la lista que la hoja pueda tener adentro.
        .activeOffsetY([-10, 10])
        .onStart(() => {
          desde.set(y.get());
        })
        .onUpdate((e) => {
          const siguiente = desde.get() + e.translationY;
          y.set(siguiente >= 0 ? siguiente : resistencia(siguiente, alto));
        })
        .onEnd((e) => {
          const proyectado = y.get() + proyectar(e.velocityY);
          if (proyectado > alto * 0.4) {
            y.set(
              withSpring(
                alto,
                {
                  duration: 300,
                  dampingRatio: 1,
                  velocity: e.velocityY,
                  // Sin esto la hoja se pasa del borde y deja ver un hueco.
                  overshootClamping: true,
                },
                (terminada) => {
                  if (terminada) scheduleOnRN(cerrar);
                }
              )
            );
          } else {
            y.set(
              withSpring(0, {
                duration: 300,
                dampingRatio: 0.8,
                velocity: e.velocityY,
              })
            );
            // Volvió a su lugar: un golpecito para decirlo.
            scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
          }
        }),
    [alto, cerrar, desde, y]
  );

  const estiloHoja = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
  }));

  /** El velo sale del mismo valor, así nunca se desincroniza y no cuesta nada. */
  const estiloVelo = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, alto], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Modal
      visible={visible}
      transparent
      // La animación de entrada la hace `Modal`; la de salida y el arrastre son
      // nuestros, por eso `none` y el valor arranca en cero.
      animationType="none"
      onShow={() => {
        y.set(reducido ? 0 : alto);
        y.set(
          reducido
            ? withTiming(0, { duration: 1 })
            : withSpring(0, { duration: 300, dampingRatio: 0.85 })
        );
      }}
      onRequestClose={onCerrar}
    >
      <View style={styles.contenedor}>
        <Animated.View style={[styles.velo, estiloVelo]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} />
        </Animated.View>

        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={(e) => setAlto(e.nativeEvent.layout.height)}
            style={[
              styles.hoja,
              {
                maxHeight: height * maxAlto,
                // El safe area **y nada más**: `insets.bottom` ya son los ~34pt
                // del indicador de inicio, y sumarle 16 dejaba medio dedo de
                // blanco debajo del último botón. En un teléfono sin indicador
                // el inset es 0, así que ahí sí hace falta un mínimo.
                paddingBottom: Math.max(insets.bottom, 14),
              },
              estiloHoja,
            ]}
          >
            {/* Ahora el agarre dice la verdad. */}
            <View style={styles.agarre} />
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: "flex-end" },
  velo: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  hoja: {
    backgroundColor: tema.fondo,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  agarre: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    marginBottom: 12,
  },
});
