import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PastillaDeHoja } from "./CabeceraDeHoja";
import { tema } from "../../lib/tema";

/**
 * El encabezado de un formulario: *Cancelar* a la izquierda, la acción a la
 * derecha, el título en el medio. Fijo arriba, como el de la ficha de la
 * visita cuando tiene cambios sin guardar.
 *
 * Los dos son **pastillas** (`PastillaDeHoja`: gris la de salir, verde la
 * acción), las mismas de las hojas y de la ficha de una ubicación; eran texto
 * suelto en unas pantallas y botones en otras.
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
  sinRaya = false,
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
   * Sin la raya de abajo: cuando reemplaza al encabezado de una ficha (que no
   * la tiene) mientras hay cambios sin guardar.
   */
  sinRaya?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.encabezado, sinRaya && styles.sinRaya, { paddingTop: insets.top + 6 }]}>
      {/* Los dos lados del mismo ancho mínimo, para que el título quede al
          centro aunque las pastillas digan cosas de distinto largo. */}
      <View style={styles.lado}>
        <PastillaDeHoja texto={textoCancelar} onPress={onCancelar} disabled={cargando} />
      </View>
      <Text style={styles.titulo} numberOfLines={1}>
        {titulo}
      </Text>
      <View style={[styles.lado, styles.derecha]}>
        {accion && onAccion ? (
          <PastillaDeHoja
            texto={accion}
            primaria
            onPress={onAccion}
            disabled={deshabilitado}
            cargando={cargando}
          />
        ) : cargando ? (
          <ActivityIndicator size="small" color={tema.verde} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  sinRaya: { borderBottomWidth: 0 },
  lado: { minWidth: 76, flexDirection: "row" },
  derecha: { justifyContent: "flex-end" },
  titulo: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
  },
});
