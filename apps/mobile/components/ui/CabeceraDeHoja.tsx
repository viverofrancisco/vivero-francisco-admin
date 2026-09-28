import { Platform, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/lib/tema";

/**
 * Lo que va arriba del contenido de una hoja `pageSheet`: en iOS ya arranca
 * debajo de la barra de estado, así que un margen fijo; en Android el modal
 * es la pantalla entera y ahí sí hace falta el inset.
 */
export const arribaDeLaHoja = (insetTop: number) =>
  Platform.OS === "ios" ? 12 : insetTop + 8;

/**
 * La cabecera de una hoja `pageSheet`, la de Shopify: la ✕ redonda a la
 * izquierda, el título centrado con un renglón chico debajo, y a la derecha
 * lo que la hoja ofrece — botones redondos o una pastilla *Guardar*.
 */
export function CabeceraDeHoja({
  titulo,
  subtitulo,
  onCerrar,
  cerrando = "cerrar",
  derecha,
}: {
  titulo?: string;
  subtitulo?: string;
  onCerrar: () => void;
  /** La ✕, o *Cancelar* en texto cuando hay algo que se perdería. */
  cerrando?: "cerrar" | "cancelar";
  derecha?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.cabecera, { paddingTop: arribaDeLaHoja(insets.top) }]}>
      {cerrando === "cancelar" ? (
        <PastillaDeHoja texto="Cancelar" onPress={onCerrar} />
      ) : (
        <BotonRedondoDeHoja icono="close-outline" etiqueta="Cerrar" onPress={onCerrar} />
      )}
      <View style={styles.centro}>
        {titulo ? (
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo}
          </Text>
        ) : null}
        {subtitulo ? (
          <Text style={styles.subtitulo} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
      <View style={styles.derecha}>{derecha}</View>
    </View>
  );
}

/**
 * Un botón redondo de la cabecera: la ✕, ⋯, ⊕.
 *
 * 36 de círculo con el ícono en 18 y el trazo fino: nació en 40 con el ícono
 * en 22 y se veía enorme al lado del título y de la pastilla de 30.
 */
export function BotonRedondoDeHoja({
  icono,
  etiqueta,
  onPress,
  disabled = false,
}: {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  etiqueta: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Ionicons name={icono} size={18} color={tema.texto} />
    </Pressable>
  );
}

/**
 * Una pastilla de la cabecera: *Guardar*, *Listo*, *Cancelar*.
 *
 * Los mismos números que el *Guardar* de *Ordenar tareas* y el *Crear* de las
 * listas: 30 de alto, 12 de costado, 13 semibold. Nació con los 40 del
 * selector de fotos y quedaba más grande que todo lo que tenía al lado.
 */
export function PastillaDeHoja({
  texto,
  onPress,
  primaria = false,
  disabled = false,
  cargando = false,
}: {
  texto: string;
  onPress: () => void;
  primaria?: boolean;
  disabled?: boolean;
  cargando?: boolean;
}) {
  const apagada = disabled || cargando;
  return (
    <Pressable
      onPress={onPress}
      disabled={apagada}
      style={({ pressed }) => [
        styles.pastilla,
        primaria && styles.pastillaPrimaria,
        apagada && styles.apagada,
        pressed && styles.tocado,
      ]}
      accessibilityRole="button"
    >
      {cargando ? (
        <ActivityIndicator size="small" color={primaria ? "#fff" : tema.verde} />
      ) : (
        <Text style={[styles.pastillaTexto, primaria && styles.pastillaTextoPrimaria]}>
          {texto}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: tema.superficie,
  },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 36 },
  titulo: { fontSize: 17, fontWeight: "700", color: tema.texto, textAlign: "center" },
  subtitulo: { fontSize: 13, color: tema.texto3, textAlign: "center", marginTop: 1 },
  derecha: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 36, justifyContent: "flex-end" },
  redondo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
  },
  tocado: { opacity: 0.6 },
  pastilla: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
  },
  pastillaPrimaria: { backgroundColor: tema.verde },
  pastillaTexto: { fontSize: 13, fontWeight: "600", color: tema.texto },
  pastillaTextoPrimaria: { color: "#fff" },
  apagada: { opacity: 0.4 },
});
