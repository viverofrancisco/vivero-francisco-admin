import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * El encabezado de un formulario: *Cancelar* a la izquierda, la acción a la
 * derecha, el título en el medio. Fijo arriba, como el de la ficha de la
 * visita cuando tiene cambios sin guardar.
 *
 * La acción vive acá y no en una barra al pie: es lo único que no se va
 * scrolleando, y arriba es donde el portal pone *Crear* y *Cancelar* en la
 * misma pantalla. La barra nativa que decía "index" en la flecha se va con
 * `headerShown: false`.
 */
export function EncabezadoDeFormulario({
  titulo,
  accion,
  onAccion,
  onCancelar,
  cargando = false,
  deshabilitado = false,
}: {
  titulo: string;
  /** "Crear", "Emitir", "Guardar". */
  accion: string;
  onAccion: () => void;
  onCancelar: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const apagado = cargando || deshabilitado;
  return (
    <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
      <PressableScale
        onPress={onCancelar}
        disabled={cargando}
        hitSlop={8}
        style={styles.boton}
        estiloPresionado={styles.botonTocado}
      >
        <Text style={styles.cancelar}>Cancelar</Text>
      </PressableScale>
      <Text style={styles.titulo} numberOfLines={1}>
        {titulo}
      </Text>
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
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  boton: { minWidth: 76, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8 },
  botonTocado: { backgroundColor: "rgba(0,0,0,0.05)" },
  cancelar: { color: tema.texto2, fontSize: 16, fontWeight: "600" },
  titulo: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
  },
  accion: { color: tema.verde, fontSize: 16, fontWeight: "700", textAlign: "right" },
  accionApagada: { color: tema.texto3 },
});
