import { StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/** Un renglón de una hoja de acciones, la de Shopify: el ícono y el nombre. */
export function AccionDeHoja({
  icono,
  texto,
  peligro = false,
  onPress,
}: {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  texto: string;
  peligro?: boolean;
  onPress: () => void;
}) {
  const color = peligro ? tema.rojo : tema.texto;
  return (
    <PressableScale onPress={onPress} estiloExterno={styles.ancho} style={styles.accion}>
      <Ionicons name={icono} size={20} color={color} />
      <Text style={[styles.accionTexto, { color }]}>{texto}</Text>
    </PressableScale>
  );
}

/** El título de la hoja, *Acciones*, como lo pone Shopify. */
export function TituloDeHoja({ texto }: { texto: string }) {
  return <Text style={styles.titulo}>{texto}</Text>;
}

const styles = StyleSheet.create({
  ancho: { alignSelf: "stretch" },
  titulo: { fontSize: 17, fontWeight: "700", color: tema.texto, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },
  accion: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  accionTexto: { fontSize: 17 },
});
