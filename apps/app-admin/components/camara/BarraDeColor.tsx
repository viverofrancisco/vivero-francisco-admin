import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { colorEnLaBarra } from "@/lib/edicion-de-fotos";

const BANDAS = Array.from({ length: 60 }, (_, i) => colorEnLaBarra((i + 0.5) / 60));

/**
 * La barra de colores de WhatsApp, de pie a la derecha: se desliza el dedo
 * y el color sigue al dedo, con una bola grande a la izquierda mientras se
 * toca para ver cuál es. Blanco a negro arriba, el arco iris debajo.
 *
 * No hay degradados sin un módulo nativo, así que son sesenta bandas: a ese
 * ancho no se notan.
 */
export function BarraDeColor({
  posicion,
  alto = 240,
  onCambio,
}: {
  /** Dónde está el color elegido, de 0 (arriba) a 1. */
  posicion: number;
  alto?: number;
  onCambio: (posicion: number, color: string) => void;
}) {
  const [tocando, setTocando] = useState(false);

  function mover(y: number) {
    const p = Math.min(Math.max(y / alto, 0), 1);
    onCambio(p, colorEnLaBarra(p));
  }

  const gesto = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => {
      setTocando(true);
      mover(e.y);
    })
    .onUpdate((e) => mover(e.y))
    .onFinalize(() => setTocando(false));

  const color = colorEnLaBarra(posicion);
  return (
    <GestureDetector gesture={gesto}>
      <View style={[styles.zona, { height: alto }]} hitSlop={{ left: 12, right: 12, top: 12, bottom: 12 }}>
        <View style={styles.barra}>
          {BANDAS.map((c, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: c }} />
          ))}
        </View>
        <View
          pointerEvents="none"
          style={[
            tocando ? styles.bola : styles.marca,
            { backgroundColor: color, top: posicion * alto - (tocando ? 20 : 9) },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  zona: { width: 36, alignItems: "center" },
  barra: {
    flex: 1,
    width: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
  },
  marca: {
    position: "absolute",
    left: 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#fff",
  },
  bola: {
    position: "absolute",
    left: -36,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#fff",
  },
});
