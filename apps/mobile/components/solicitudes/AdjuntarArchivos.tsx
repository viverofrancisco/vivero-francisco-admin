import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { MAX_ADJUNTOS_SOLICITUD } from "@vivero/shared";
import { PressableScale } from "@/components/ui/PressableScale";
import { SelectorDeGaleria } from "@/components/SelectorDeGaleria";
import {
  archivoDeAssetDeCamara,
  type ArchivoDeGaleria,
  type ArchivoLocal,
} from "@/lib/galeria";
import { tema } from "@/lib/tema";

/**
 * *Fotos o videos*, opcional: que el cliente muestre su jardín antes de que
 * vayamos —el seto que quiere bajar, la mancha del césped—. Se juntan como
 * los adjuntos de la novedad: la bandeja con una miniatura por archivo y su
 * ✕, *Cámara* y *Galería* que **agregan**, y la galería propia
 * (`SelectorDeGaleria`), que abre con lo ya elegido marcado y devuelve la
 * selección entera; lo que vino de la cámara se queda. Se suben recién al
 * enviar la solicitud.
 */
export function AdjuntarArchivos({
  archivos,
  onCambio,
}: {
  archivos: ArchivoLocal[];
  onCambio: (a: ArchivoLocal[]) => void;
}) {
  const [galeria, setGaleria] = useState(false);
  const lugarLibre = MAX_ADJUNTOS_SOLICITUD - archivos.length;
  const deLaCamara = archivos.filter((a) => !a.assetId);

  async function conLaCamara() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.7,
    });
    if (!r.canceled) {
      onCambio([...archivos, ...r.assets.map(archivoDeAssetDeCamara)].slice(0, MAX_ADJUNTOS_SOLICITUD));
    }
  }

  function alConfirmarGaleria(elegidos: ArchivoDeGaleria[]) {
    setGaleria(false);
    onCambio([...deLaCamara, ...elegidos].slice(0, MAX_ADJUNTOS_SOLICITUD));
  }

  return (
    <View>
      <Text style={styles.rotulo}>FOTOS O VIDEOS (OPCIONAL)</Text>
      {archivos.length > 0 ? (
        <View style={styles.bandeja}>
          {archivos.map((a, i) => (
            <View key={`${a.uri}-${i}`} style={styles.miniatura}>
              {a.tipo === "video" ? (
                <View style={[styles.miniaturaFoto, styles.video]}>
                  <Ionicons name="play" size={20} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: a.uri }} style={styles.miniaturaFoto} contentFit="cover" />
              )}
              <PressableScale
                onPress={() => onCambio(archivos.filter((_, j) => j !== i))}
                // En `estiloExterno`: el absoluto va en el `Pressable` de
                // afuera, o queda recortado por la miniatura.
                estiloExterno={styles.quitar}
                hitSlop={8}
                accessibilityLabel="Quitar el archivo"
              >
                <Ionicons name="close" size={12} color="#fff" />
              </PressableScale>
            </View>
          ))}
        </View>
      ) : null}

      {lugarLibre > 0 ? (
        <View style={styles.fila}>
          <PressableScale onPress={conLaCamara} style={styles.pildora}>
            <Ionicons name="camera-outline" size={18} color={tema.verde700} />
            <Text style={styles.pildoraTexto}>Cámara</Text>
          </PressableScale>
          <PressableScale onPress={() => setGaleria(true)} style={styles.pildora}>
            <Ionicons name="images-outline" size={18} color={tema.verde700} />
            <Text style={styles.pildoraTexto}>Galería</Text>
          </PressableScale>
        </View>
      ) : null}

      {galeria ? (
        <SelectorDeGaleria
          titulo="Fotos o videos"
          conVideos
          maximo={MAX_ADJUNTOS_SOLICITUD - deLaCamara.length}
          preseleccion={archivos.flatMap((a) => (a.assetId ? [a.assetId] : []))}
          onCerrar={() => setGaleria(false)}
          onConfirmar={alConfirmarGaleria}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rotulo: { color: tema.texto3, fontSize: 11, letterSpacing: 0.8, paddingLeft: 4, marginTop: 8 },
  bandeja: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  miniatura: { width: 64, height: 64, borderRadius: 8, overflow: "hidden" },
  miniaturaFoto: { width: "100%", height: "100%", backgroundColor: tema.lienzo },
  video: { backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  quitar: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  fila: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  pildora: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: tema.verde50,
    borderWidth: 1,
    borderColor: tema.verde100,
  },
  pildoraTexto: { color: tema.verde700, fontWeight: "600", fontSize: 14 },
});
