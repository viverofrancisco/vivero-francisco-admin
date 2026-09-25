import { StyleSheet, View } from "react-native";
import { ActivityIndicator, ProgressBar, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { MenuDeEncabezado, type OpcionDeMenu } from "@/components/ui/MenuDeEncabezado";
import { tema } from "@/lib/tema";

/**
 * El encabezado de un asistente por pasos: la ✕ (o la flecha, desde el
 * segundo paso) a la izquierda, "Paso N de M" en el medio, la acción del
 * paso a la derecha, y la barra de progreso debajo.
 *
 * Es `EncabezadoDeFormulario` con contador: *Continuar* vivía en un botón
 * ancho al pie, y con la lista de clientes o el calendario ocupando la
 * pantalla quedaba lejos del pulgar y tapaba la última fila. Arriba es donde
 * están *Crear* y *Guardar* en las demás pantallas, y donde queda fijo.
 */
export function EncabezadoDePasos({
  paso,
  total,
  onAtras,
  accion,
  onAccion,
  deshabilitado = false,
  cargando = false,
  opciones = [],
}: {
  /** Desde cero. */
  paso: number;
  total: number;
  /** En el primer paso es cerrar; después, volver un paso. */
  onAtras: () => void;
  /** "Continuar" en los pasos del medio; "Generar", "Crear" en el último. */
  accion: string;
  onAccion: () => void;
  deshabilitado?: boolean;
  cargando?: boolean;
  /**
   * Lo que el paso ofrece además de su acción —*Vista previa*, *Guardar
   * borrador*— en un ⋯ junto a ella, como el del portal en el teléfono.
   */
  opciones?: OpcionDeMenu[];
}) {
  const insets = useSafeAreaInsets();
  const apagado = cargando || deshabilitado;
  return (
    <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
      <View style={styles.fila}>
        <PressableScale
          onPress={onAtras}
          disabled={cargando}
          hitSlop={8}
          style={styles.volver}
          accessibilityLabel={paso === 0 ? "Cerrar" : "Atrás"}
        >
          <Ionicons
            name={paso === 0 ? "close" : "chevron-back"}
            size={24}
            color={tema.texto}
          />
        </PressableScale>
        <Text style={styles.contador}>
          Paso {paso + 1} de {total}
        </Text>
        {opciones.length > 0 ? <MenuDeEncabezado opciones={opciones} /> : null}
        <PressableScale
          onPress={onAccion}
          disabled={apagado}
          hitSlop={8}
          style={styles.boton}
          estiloPresionado={styles.botonTocado}
        >
          {cargando ? (
            <ActivityIndicator size="small" color={tema.verde} />
          ) : (
            <Text style={[styles.accion, deshabilitado && styles.accionApagada]}>
              {accion}
            </Text>
          )}
        </PressableScale>
      </View>
      <ProgressBar
        progress={(paso + 1) / total}
        color={tema.verde}
        style={styles.progreso}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  volver: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  contador: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: tema.texto2,
  },
  boton: {
    minWidth: 76,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "flex-end",
  },
  botonTocado: { backgroundColor: "rgba(0,0,0,0.05)" },
  accion: { color: tema.verde, fontSize: 16, fontWeight: "700", textAlign: "right" },
  accionApagada: { color: tema.texto3 },
  progreso: { height: 3 },
});
