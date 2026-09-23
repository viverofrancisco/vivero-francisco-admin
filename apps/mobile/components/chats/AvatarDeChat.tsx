import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tema } from "@/lib/tema";

/**
 * La foto del grupo, o el ícono de chat mientras no tenga una. Redonda y del
 * tamaño que se le pida, para la lista, el encabezado y el formulario.
 */
export function AvatarDeChat({
  imagenUrl,
  lado = 40,
}: {
  imagenUrl?: string | null;
  lado?: number;
}) {
  const caja = { width: lado, height: lado, borderRadius: lado / 2 };
  if (imagenUrl) {
    return <Image source={{ uri: imagenUrl }} style={[styles.foto, caja]} />;
  }
  return (
    <View style={[styles.vacio, caja]}>
      <Ionicons name="chatbubbles" size={Math.round(lado * 0.45)} color={tema.verde700} />
    </View>
  );
}

const styles = StyleSheet.create({
  foto: { backgroundColor: tema.lienzo },
  vacio: {
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
});
