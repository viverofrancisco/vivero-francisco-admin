import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import type { EstadoAcceso } from "@/lib/types";
import { tema } from "@/lib/tema";

export const ACCESO_LABEL: Record<EstadoAcceso, string> = {
  ACTIVO: "Activo",
  PENDIENTE: "Falta que elija su contraseña",
  REVOCADO: "Revocado",
  SIN_CUENTA: "Sin cuenta",
};

/**
 * Cómo está el acceso de una cuenta, en una pastilla: verde entra, ámbar
 * falta, rojo cortado. La usan la ficha del personal y la de un usuario.
 */
export function PastillaDeAcceso({ acceso }: { acceso: EstadoAcceso }) {
  const [fondo, color] =
    acceso === "ACTIVO"
      ? [tema.verde50, tema.verde700]
      : acceso === "PENDIENTE"
        ? [tema.ambar50, tema.ambarTexto]
        : acceso === "REVOCADO"
          ? [tema.rojo50, tema.rojo]
          : [tema.linea2, tema.texto2];
  return (
    <View style={[styles.pastilla, { backgroundColor: fondo }]}>
      <Text style={[styles.texto, { color }]}>{ACCESO_LABEL[acceso]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pastilla: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  texto: { fontSize: 12, fontWeight: "600" },
});
