import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { MediaViewer, type MediaViewerSource } from "./MediaViewer";
import { tema } from "../lib/tema";

export interface AdjuntoMiniatura {
  id: string;
  url: string;
  tipo: "imagen" | "video" | string;
}

/**
 * Las fotos y los videos de algo —una solicitud— en miniaturas que **se abren
 * en la app**: la foto a pantalla completa, el video con su reproductor
 * (`MediaViewer`). Antes se abrían con `Linking`, que sacaba a la persona al
 * navegador para mirar una foto.
 */
export function MiniaturasDeAdjuntos({
  adjuntos,
  lado = 84,
}: {
  adjuntos: AdjuntoMiniatura[];
  /** El lado de cada miniatura, en puntos. */
  lado?: number;
}) {
  const [abierto, setAbierto] = useState<MediaViewerSource | null>(null);
  return (
    <>
      <View style={styles.fila}>
        {adjuntos.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setAbierto({ url: a.url, tipo: a.tipo })}
            accessibilityRole="button"
            accessibilityLabel={a.tipo === "video" ? "Ver video" : "Ver foto"}
            style={({ pressed }) => [
              styles.miniatura,
              { width: lado, height: lado },
              pressed && styles.tocada,
            ]}
          >
            {a.tipo === "video" ? (
              <View style={[styles.imagen, styles.video]}>
                <Ionicons name="play" size={22} color="#fff" />
              </View>
            ) : (
              <Image source={{ uri: a.url }} style={styles.imagen} contentFit="cover" />
            )}
          </Pressable>
        ))}
      </View>
      <MediaViewer media={abierto} onClose={() => setAbierto(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniatura: { borderRadius: 10, overflow: "hidden" },
  tocada: { opacity: 0.6 },
  imagen: { width: "100%", height: "100%", backgroundColor: tema.lienzo },
  video: { backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
});
