import { useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as VideoThumbnails from "expo-video-thumbnails";

/**
 * Un cuadro del video por archivo, sacado una sola vez: la tira de la cámara,
 * el editor y la bandeja del chat muestran el mismo video y no tiene sentido
 * decodificarlo en cada una. Se guarda la promesa, así dos que piden a la vez
 * esperan la misma.
 */
const cuadros = new Map<string, Promise<string | null>>();

export function cuadroDelVideo(uri: string): Promise<string | null> {
  let p = cuadros.get(uri);
  if (!p) {
    p = VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.6 })
      .then((r) => r.uri)
      .catch(() => null);
    cuadros.set(uri, p);
  }
  return p;
}

/**
 * La miniatura de un video como en WhatsApp: su primer cuadro con un play
 * encima. Mientras el cuadro no está (o si no se pudo sacar) queda el fondo
 * oscuro con el play, que es lo que se veía siempre.
 */
export function MiniaturaDeVideo({
  uri,
  style,
  tamanoDelPlay = 18,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  tamanoDelPlay?: number;
}) {
  const [cuadro, setCuadro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void cuadroDelVideo(uri).then((c) => vivo && setCuadro(c));
    return () => {
      vivo = false;
    };
  }, [uri]);

  return (
    <View style={[styles.caja, style, styles.fondo]}>
      {cuadro ? (
        <Image source={{ uri: cuadro }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <View style={styles.play}>
        <Ionicons name="play" size={tamanoDelPlay} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  // Después del estilo de quien la usa: un fondo claro dejaba el play blanco sin ver.
  fondo: { backgroundColor: "#333" },
  play: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
});
