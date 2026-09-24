import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { tema } from "@/lib/tema";

/**
 * Activo o inactivo, siempre al lado del nombre: mostrar solo el inactivo
 * dejaba al activo sin decir nada, y una insignia que a veces está y a veces
 * no se lee como un dato que falta. La misma pastilla que el portal.
 */
export function EstadoDelCliente({ inactivo }: { inactivo: boolean }) {
  return (
    <View style={[styles.pastilla, inactivo ? styles.inactivo : styles.activo]}>
      <Text style={[styles.texto, inactivo ? styles.inactivoTexto : styles.activoTexto]}>
        {inactivo ? "Inactivo" : "Activo"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pastilla: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, alignSelf: "flex-start" },
  activo: { backgroundColor: tema.verde50 },
  inactivo: { backgroundColor: tema.lienzo },
  texto: { fontSize: 11, fontWeight: "600" },
  activoTexto: { color: tema.verde700 },
  inactivoTexto: { color: tema.texto2 },
});
