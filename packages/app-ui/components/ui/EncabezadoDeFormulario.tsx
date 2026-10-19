import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "./PressableScale";
import { PastillaDeHoja } from "./CabeceraDeHoja";
import { tema } from "../../lib/tema";

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
  textoCancelar = "Cancelar",
  cargando = false,
  deshabilitado = false,
  pastillas = false,
}: {
  titulo: string;
  /**
   * "Crear", "Emitir", "Guardar". Sin acción queda solo la de la izquierda (un
   * paso que se resuelve solo, como el código que valida al sexto dígito).
   */
  accion?: string;
  onAccion?: () => void;
  onCancelar: () => void;
  /** "Atrás" donde salir es volver al paso anterior, no descartar. */
  textoCancelar?: string;
  cargando?: boolean;
  deshabilitado?: boolean;
  /**
   * Botones en pastilla en vez de texto: para la ficha que se edita en el
   * lugar y solo muestra este encabezado cuando hay cambios.
   */
  pastillas?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const apagado = cargando || deshabilitado;
  if (pastillas) {
    return (
      // Sin la raya de abajo: reemplaza al de la ficha, que no la tiene.
      <View style={[styles.encabezado, styles.sinRaya, { paddingTop: insets.top + 6 }]}>
        <PastillaDeHoja texto={textoCancelar} onPress={onCancelar} disabled={cargando} />
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        {accion && onAccion ? (
          <PastillaDeHoja
            texto={accion}
            primaria
            onPress={onAccion}
            disabled={deshabilitado}
            cargando={cargando}
          />
        ) : null}
      </View>
    );
  }
  return (
    <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
      <PressableScale
        onPress={onCancelar}
        disabled={cargando}
        hitSlop={8}
        style={styles.boton}
        estiloPresionado={styles.botonTocado}
      >
        <Text style={styles.cancelar}>{textoCancelar}</Text>
      </PressableScale>
      <Text style={styles.titulo} numberOfLines={1}>
        {titulo}
      </Text>
      {accion && onAccion ? (
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
            <Text
              style={[styles.accion, deshabilitado && styles.accionApagada]}
            >
              {accion}
            </Text>
          )}
        </PressableScale>
      ) : (
        // Del mismo ancho que el botón, para que el título siga centrado.
        <View style={styles.boton}>
          {cargando ? (
            <ActivityIndicator size="small" color={tema.verde} />
          ) : null}
        </View>
      )}
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
  boton: {
    minWidth: 76,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sinRaya: { borderBottomWidth: 0 },
  botonTocado: { backgroundColor: "rgba(0,0,0,0.05)" },
  cancelar: { color: tema.texto2, fontSize: 16, fontWeight: "600" },
  titulo: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
  },
  accion: {
    color: tema.verde,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  accionApagada: { color: tema.texto3 },
});
