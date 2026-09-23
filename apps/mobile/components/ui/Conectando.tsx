import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useConexion } from "@/lib/conexion";
import { tema } from "@/lib/tema";

/**
 * El "Conectando…" de WhatsApp: una línea arriba del contenido mientras la
 * app no llega al servidor, y nada cuando sí. No explica nada más —ni qué
 * se guardó ni qué va a pasar—: lo que se ve sigue siendo lo último que se
 * tuvo, y lo que se mande espera con su ✓.
 */
export function Conectando() {
  const enLinea = useConexion((s) => s.enLinea);
  if (enLinea) return null;
  return (
    <View style={styles.barra} accessibilityLiveRegion="polite">
      <ActivityIndicator size={12} color={tema.texto3} />
      <Text style={styles.texto}>Conectando…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
    backgroundColor: tema.lienzo,
  },
  texto: { fontSize: 12, fontWeight: "600", color: tema.texto3 },
});
