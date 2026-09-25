import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * El encabezado de una ficha: la flecha de volver al lado del nombre, fijo
 * arriba mientras el cuerpo scrollea.
 *
 * Es el de la ficha de la visita, sacado para que las demás fichas —la orden,
 * la suscripción— se vean igual. La barra nativa decía "Orden" arriba de una
 * orden, y la flecha mostraba "index" —el nombre de la ruta— porque la lista
 * de la que se viene no tiene título del cual tomarlo. La flecha vive al lado
 * del nombre, que es donde el pulgar la busca. Para usarlo la pantalla tiene
 * que ir con `headerShown: false` en su `Stack`.
 */
export function EncabezadoDeFicha({
  titulo,
  derecha,
}: {
  titulo: string;
  /** Algo chico a la derecha del título: una pastilla de estado. */
  derecha?: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
      <PressableScale
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.volver}
        accessibilityLabel="Volver"
      >
        <Ionicons name="chevron-back" size={24} color={tema.texto} />
      </PressableScale>
      <View style={styles.texto}>
        <Text style={styles.titulo} numberOfLines={2}>
          {titulo}
        </Text>
      </View>
      {derecha}
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  volver: {
    width: 40,
    height: 40,
    marginLeft: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  texto: { flex: 1 },
  titulo: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: tema.texto,
  },
});
