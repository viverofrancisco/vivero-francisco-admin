import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import type { EmisorConfig } from "@/lib/types";
import { tema } from "@/lib/tema";

/** Predeterminado, el ambiente y si está inactivo: lo que distingue un RUC de otro. */
export function PastillasDeEmisor({ emisor }: { emisor: EmisorConfig }) {
  return (
    <View style={styles.fila}>
      {emisor.predeterminado ? <Pastilla texto="Predeterminado" fondo={tema.verde50} color={tema.verde700} /> : null}
      {emisor.ambiente === "PRODUCCION" ? (
        <Pastilla texto="Producción" fondo={tema.verde} color="#fff" />
      ) : (
        <Pastilla texto="Pruebas" fondo={tema.linea2} color={tema.texto2} />
      )}
      {!emisor.activo ? <Pastilla texto="Inactivo" fondo={tema.linea2} color={tema.texto3} /> : null}
      {!emisor.certificadoSujeto ? (
        <Pastilla texto="Sin firma" fondo={tema.ambar50} color={tema.ambarTexto} />
      ) : null}
    </View>
  );
}

function Pastilla({ texto, fondo, color }: { texto: string; fondo: string; color: string }) {
  return (
    <View style={[styles.pastilla, { backgroundColor: fondo }]}>
      <Text style={[styles.texto, { color }]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pastilla: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  texto: { fontSize: 11, fontWeight: "700" },
});
