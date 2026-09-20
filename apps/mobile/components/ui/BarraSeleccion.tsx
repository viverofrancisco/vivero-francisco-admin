import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * La barra de selección múltiple, flotando arriba de la barra de pestañas.
 *
 * Es la misma del portal en móvil (`BarraSeleccionMovil`): una pastilla oscura
 * con la cuenta a la izquierda —que es también por donde se sale— y las
 * acciones a la derecha. Aparece con el modo prendido **aunque no haya nada
 * marcado**: es lo que dice que el modo está prendido, y por dónde se apaga.
 *
 * **Las acciones no van en rojo aunque destruyan.** Sobre un fondo oscuro lo
 * que hace falta es contraste; el rojo lo pone la confirmación, que es donde se
 * decide.
 */
export function BarraSeleccion({
  cuantas,
  onSalir,
  children,
}: {
  cuantas: number;
  onSalir: () => void;
  children?: React.ReactNode;
}) {
  // El borde de abajo no es el borde de la pantalla: está el indicador de
  // inicio, y adentro de una hoja, la esquina redondeada. Apoyada ahí, la
  // pastilla quedaba cortada.
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.caja, { bottom: Math.max(insets.bottom, 16) }]}
      pointerEvents="box-none"
    >
      <View style={styles.pastilla}>
        <PressableScale
          onPress={onSalir}
          style={styles.salir}
          accessibilityLabel="Salir de la selección"
        >
          <Ionicons name="close" size={18} color={tema.superficie} />
          <Text style={styles.cuenta}>{cuantas}</Text>
        </PressableScale>
        <View style={styles.crece} />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { position: "absolute", left: 12, right: 12 },
  pastilla: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 6,
    borderRadius: 14,
    backgroundColor: tema.texto,
    shadowColor: "#142819",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  salir: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  cuenta: {
    color: tema.superficie,
    fontWeight: "700",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  crece: { flex: 1 },
});

/** Lo que mide la barra, para que la lista deje lugar y no tape la última fila. */
export const ALTO_BARRA_SELECCION = 62;
