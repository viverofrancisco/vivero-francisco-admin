import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/lib/tema";

/** Cuánto hay que correr el mensaje para que el gesto cuente. */
const UMBRAL = 56;
/** Hasta dónde acompaña el mensaje al dedo. */
const TOPE = 88;

function vibrar() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Los dos gestos de WhatsApp sobre un mensaje: **correrlo a la derecha
 * responde**, y correr uno propio a la izquierda abre su info.
 *
 * El gesto se toma en la **fila entera** —el dedo no tiene por qué caer
 * justo sobre la burbuja— y lo que se mueve es la burbuja, con el ícono
 * asomando detrás a medida que avanza. Se distingue del scroll de la lista
 * por la primera dirección: `failOffsetY` lo rinde si el dedo arranca hacia
 * arriba o abajo, y `activeOffsetX` lo toma cuando arranca hacia el costado.
 * Un toque corto no lo activa, así que el toque y el mantener apretado de la
 * burbuja siguen siendo suyos.
 *
 * Al cruzar el umbral vibra una vez —el "ya cuenta" que el ojo no ve porque
 * el dedo tapa el ícono— y al soltar vuelve con un resorte, sin quedarse
 * abierto: el gesto es un disparador, no un cajón.
 */
export function FilaDeslizable({
  children,
  alineado,
  onDerecha,
  onIzquierda,
  estilo,
}: {
  children: React.ReactNode;
  /** A qué lado va la burbuja. */
  alineado: "derecha" | "izquierda";
  /** Correr a la derecha: responder. Sin esto, ese lado no se mueve. */
  onDerecha?: () => void;
  /** Correr a la izquierda: la info del mensaje. Solo en los propios. */
  onIzquierda?: () => void;
  estilo?: StyleProp<ViewStyle>;
}) {
  const tx = useSharedValue(0);
  const cruzado = useSharedValue(false);
  const reducido = useReducedMotion();
  const haciaDerecha = Boolean(onDerecha);
  const haciaIzquierda = Boolean(onIzquierda);

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-10, 10])
    .enabled(haciaDerecha || haciaIzquierda)
    .onUpdate((e) => {
      const maximo = haciaDerecha ? TOPE : 0;
      const minimo = haciaIzquierda ? -TOPE : 0;
      const x = Math.max(minimo, Math.min(maximo, e.translationX));
      tx.set(x);
      const ahora = Math.abs(x) >= UMBRAL;
      if (ahora !== cruzado.get()) {
        cruzado.set(ahora);
        if (ahora) scheduleOnRN(vibrar);
      }
    })
    .onEnd(() => {
      const x = tx.get();
      if (x >= UMBRAL && onDerecha) scheduleOnRN(onDerecha);
      else if (x <= -UMBRAL && onIzquierda) scheduleOnRN(onIzquierda);
    })
    .onFinalize(() => {
      cruzado.set(false);
      tx.set(reducido ? 0 : withSpring(0, { duration: 320, dampingRatio: 0.85 }));
    });

  const estiloBurbuja = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }],
  }));
  const estiloResponder = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, tx.get()) / UMBRAL),
  }));
  const estiloInfo = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -tx.get()) / UMBRAL),
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={estilo}>
        <Animated.View
          style={[
            styles.burbuja,
            alineado === "derecha" ? styles.aLaDerecha : styles.aLaIzquierda,
            estiloBurbuja,
          ]}
        >
          {haciaDerecha ? (
            <Animated.View style={[styles.icono, styles.iconoIzquierdo, estiloResponder]}>
              <Ionicons name="arrow-undo" size={16} color={tema.texto2} />
            </Animated.View>
          ) : null}
          {haciaIzquierda ? (
            <Animated.View style={[styles.icono, styles.iconoDerecho, estiloInfo]}>
              <Ionicons name="information-circle-outline" size={18} color={tema.texto2} />
            </Animated.View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  burbuja: { maxWidth: "85%" },
  aLaDerecha: { alignSelf: "flex-end" },
  aLaIzquierda: { alignSelf: "flex-start" },
  /* Los íconos que asoman detrás del mensaje mientras se lo corre. */
  icono: {
    position: "absolute",
    top: "50%",
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  iconoIzquierdo: { left: -36 },
  iconoDerecho: { right: -36 },
});
