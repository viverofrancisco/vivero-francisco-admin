import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BotonRedondoDeHoja } from "@/components/ui/CabeceraDeHoja";
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
 *
 * La flecha y el ⋯ son el círculo gris de Shopify (`BotonRedondoDeHoja`, 36
 * con el ícono en 18), centrados con el nombre: la flecha era un chevron
 * suelto y el ⋯ un cuadrado con borde, y no se leían como pareja.
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
      <BotonRedondoDeHoja
        icono="chevron-back"
        etiqueta="Volver"
        onPress={() => router.back()}
      />
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
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  texto: { flex: 1 },
  titulo: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: tema.texto,
  },
});
