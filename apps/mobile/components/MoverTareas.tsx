import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import type { DestinoDeOrden } from "@vivero/shared";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Mover las tareas marcadas de a varias, sin arrastrarlas.
 *
 * Arrastrar sirve para correr una fila un par de lugares; para mandar cinco al
 * principio de una lista de cien es un viaje largo con el dedo apretado, y basta
 * soltar antes de tiempo para empezar de nuevo. Son las mismas tres opciones que
 * en el portal —y que en Shopify, de donde viene la forma—: al principio, al
 * final, o a una posición escrita.
 *
 * Van **juntas y en el orden que ya tenían** entre ellas; de eso se encarga
 * `moverEnOrden`, que es el mismo código que usa el portal.
 */
export function MoverTareas({
  visible,
  cuantas,
  /** Cuántas hay en total, para no aceptar una posición que no existe. */
  total,
  onCerrar,
  onMover,
}: {
  visible: boolean;
  cuantas: number;
  total: number;
  onCerrar: () => void;
  onMover: (destino: DestinoDeOrden) => void;
}) {
  const [posicion, setPosicion] = useState("1");

  const n = Number(posicion);
  const valida = Number.isInteger(n) && n >= 1 && n <= total;

  function mover(destino: DestinoDeOrden) {
    onCerrar();
    onMover(destino);
  }

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar}>
      <View style={styles.hoja}>
        <Text style={styles.titulo}>
          {cuantas === 1 ? "Mover 1 tarea" : `Mover ${cuantas} tareas`}
        </Text>

        <PressableScale
          onPress={() => mover("inicio")}
          estiloExterno={styles.ancho}
          style={styles.opcion}
        >
          <Ionicons name="arrow-up" size={18} color={tema.texto2} />
          <Text style={styles.opcionTexto}>Al principio</Text>
        </PressableScale>

        <PressableScale
          onPress={() => mover("fin")}
          estiloExterno={styles.ancho}
          style={styles.opcion}
        >
          <Ionicons name="arrow-down" size={18} color={tema.texto2} />
          <Text style={styles.opcionTexto}>Al final</Text>
        </PressableScale>

        <View style={styles.opcion}>
          <Ionicons name="arrow-forward" size={18} color={tema.texto2} />
          <Text style={styles.opcionTexto}>A la posición</Text>
          <TextInput
            value={posicion}
            onChangeText={setPosicion}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={() => valida && mover(n)}
            selectTextOnFocus
            style={styles.campo}
            accessibilityLabel="Posición de destino"
          />
          <PressableScale
            onPress={() => mover(n)}
            disabled={!valida}
            style={[styles.mover, !valida && styles.apagado]}
          >
            <Text style={styles.moverTexto}>Mover</Text>
          </PressableScale>
        </View>

        <Text style={styles.nota}>
          Van juntas, en el orden que tienen entre ellas. La lista va del 1 al{" "}
          {total}.
        </Text>
      </View>
    </HojaInferior>
  );
}

const styles = StyleSheet.create({
  hoja: { paddingHorizontal: 4, paddingBottom: 8, gap: 4 },
  titulo: {
    fontSize: 18,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  ancho: { alignSelf: "stretch" },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  opcionTexto: { color: tema.texto, fontSize: 15, fontWeight: "500" },
  campo: {
    marginLeft: "auto",
    width: 64,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.linea,
    textAlign: "center",
    fontSize: 15,
    color: tema.texto,
  },
  mover: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: tema.verde,
  },
  moverTexto: { color: "#fff", fontWeight: "600", fontSize: 14 },
  apagado: { opacity: 0.4 },
  nota: { color: tema.texto3, fontSize: 13, paddingHorizontal: 10, marginTop: 4 },
});
