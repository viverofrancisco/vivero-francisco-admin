import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  MAX_FOTOS_NOVEDAD,
  MOTIVOS_NOVEDAD,
  MOTIVO_NOVEDAD_LABEL,
  type MotivoNovedad,
} from "@vivero/shared";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { Campo } from "@/components/ui/Formulario";
import { SelectorDeGaleria } from "@/components/SelectorDeGaleria";
import type { ArchivoDeGaleria } from "@/lib/galeria";
import { tema } from "@/lib/tema";

export interface FotoElegida {
  uri: string;
  fileName: string;
  contentType: string;
  /** De la galería del teléfono: con esto vuelve a salir marcada al abrirla. */
  assetId?: string;
}

export interface DatosDeNovedad {
  motivo: MotivoNovedad;
  nota: string | null;
  fotos: FotoElegida[];
}

/**
 * "No pude hacer la visita": el motivo de una lista cerrada, una nota y, si
 * sirven, fotos —el portón cerrado, la nota pegada, la calle inundada—.
 *
 * Es una hoja y no una pantalla porque se llena en la vereda, en un minuto: un
 * motivo que se toca, una línea que casi nunca se escribe, y *Enviar*. La hora
 * y la ubicación no se piden: se sellan al enviar, como en una marca, que es
 * lo que le da valor al reporte.
 *
 * Las fotos se **juntan**, como los adjuntos de un mensaje del chat: cada una
 * con su ✕, la cámara y la galería agregan y no reemplazan. Era una sola, y la
 * segunda pisaba a la primera. La galería es la propia (`SelectorDeGaleria`),
 * que abre con las ya elegidas marcadas.
 *
 * El estado vive en el contenido, que se monta con la hoja: cerrarla lo
 * descarta solo, sin un efecto que lo resetee.
 */
export function HojaNovedad({
  visible,
  enviando,
  onEnviar,
  onCerrar,
}: {
  visible: boolean;
  enviando: boolean;
  onEnviar: (datos: DatosDeNovedad) => void;
  onCerrar: () => void;
}) {
  return (
    <HojaInferior
      visible={visible}
      onCerrar={() => !enviando && onCerrar()}
      maxAlto={0.92}
    >
      {visible ? <Contenido enviando={enviando} onEnviar={onEnviar} /> : null}
    </HojaInferior>
  );
}

function Contenido({
  enviando,
  onEnviar,
}: {
  enviando: boolean;
  onEnviar: (datos: DatosDeNovedad) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoNovedad>("NADIE_EN_CASA");
  const [nota, setNota] = useState("");
  const [fotos, setFotos] = useState<FotoElegida[]>([]);
  const [galeria, setGaleria] = useState(false);

  // Con "Otro" la nota es lo único que dice qué pasó, así que ahí se exige.
  const faltaNota = motivo === "OTRO" && !nota.trim();
  const lugarLibre = MAX_FOTOS_NOVEDAD - fotos.length;
  /** Las de la cámara ocupan lugar pero no están en la galería. */
  const deLaCamara = fotos.filter((f) => !f.assetId);

  function agregar(assets: ImagePicker.ImagePickerAsset[]) {
    setFotos((actuales) =>
      [
        ...actuales,
        ...assets.map((asset) => ({
          uri: asset.uri,
          fileName:
            asset.fileName ?? asset.uri.split("/").pop() ?? `novedad-${Date.now()}.jpg`,
          contentType: asset.mimeType ?? "image/jpeg",
        })),
      ].slice(0, MAX_FOTOS_NOVEDAD)
    );
  }

  async function conLaCamara() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!r.canceled) agregar(r.assets);
  }

  /**
   * La galería propia, con las que ya están marcadas. Lo que devuelve
   * reemplaza lo que había venido de la galería; las de la cámara se quedan.
   */
  function alConfirmarGaleria(archivos: ArchivoDeGaleria[]) {
    setGaleria(false);
    setFotos((actuales) =>
      [
        ...actuales.filter((f) => !f.assetId),
        ...archivos.map((a) => ({
          uri: a.uri,
          fileName: a.fileName,
          contentType: a.contentType,
          assetId: a.assetId,
        })),
      ].slice(0, MAX_FOTOS_NOVEDAD)
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
        <Text style={styles.titulo}>No pude hacer la visita</Text>
        <Text style={styles.detalle}>
          Se guarda la hora y dónde estás, y le avisa a un administrador ahora
          mismo.
        </Text>

        <View style={styles.opciones}>
          {MOTIVOS_NOVEDAD.map((m) => {
            const activa = m === motivo;
            return (
              <Pressable
                key={m}
                onPress={() => setMotivo(m)}
                accessibilityRole="radio"
                accessibilityState={{ checked: activa }}
                style={({ pressed }) => [
                  styles.opcion,
                  activa && styles.opcionElegida,
                  pressed && !activa && styles.opcionPresionada,
                ]}
              >
                <Text style={styles.opcionTexto}>{MOTIVO_NOVEDAD_LABEL[m]}</Text>
                <View style={[styles.radio, activa && styles.radioElegido]}>
                  {activa ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Campo
          label="Qué pasó"
          required={motivo === "OTRO"}
          value={nota}
          onChangeText={setNota}
          multiline
          placeholder="Lo que te dijeron, lo que viste…"
        />

        {/* La bandeja del chat: una miniatura por foto, cada una con su ✕. */}
        {fotos.length > 0 ? (
          <View style={styles.bandeja}>
            {fotos.map((f, i) => (
              <View key={`${f.uri}-${i}`} style={styles.miniatura}>
                <Image source={{ uri: f.uri }} style={styles.miniaturaFoto} />
                <PressableScale
                  onPress={() =>
                    setFotos((actuales) => actuales.filter((_, j) => j !== i))
                  }
                  // En `estiloExterno`: el absoluto va en el `Pressable` de
                  // afuera, o queda recortado por la miniatura (ver el chat).
                  estiloExterno={styles.quitar}
                  hitSlop={8}
                  accessibilityLabel="Quitar la foto"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </PressableScale>
              </View>
            ))}
          </View>
        ) : null}

        {/* Agregan, no reemplazan. Se van cuando ya no cabe ninguna más. */}
        {lugarLibre > 0 ? (
          <View style={styles.fotoFila}>
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
            maximo={MAX_FOTOS_NOVEDAD - deLaCamara.length}
            preseleccion={fotos.flatMap((f) => (f.assetId ? [f.assetId] : []))}
            onCerrar={() => setGaleria(false)}
            onConfirmar={alConfirmarGaleria}
          />
        ) : null}

        <PressableScale
          onPress={() => onEnviar({ motivo, nota: nota.trim() || null, fotos })}
          disabled={enviando || faltaNota}
          estiloExterno={styles.ancho}
          style={[styles.enviar, faltaNota && styles.apagado]}
        >
          {enviando ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.enviarTexto}>
              {faltaNota ? "Escribe qué pasó" : "Enviar"}
            </Text>
          )}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontSize: 19,
    fontWeight: "800",
    color: tema.texto,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  detalle: {
    fontSize: 14,
    fontWeight: "500",
    color: tema.texto3,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  opciones: { gap: 6, marginBottom: 12 },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
  },
  opcionElegida: { backgroundColor: tema.verde50, borderColor: tema.verde100 },
  opcionPresionada: { backgroundColor: tema.lienzo },
  opcionTexto: { fontSize: 16, color: tema.texto, flexShrink: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },
  radioElegido: { backgroundColor: tema.verde, borderColor: tema.verde },
  bandeja: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  miniatura: { width: 56, height: 56, borderRadius: 8, overflow: "hidden" },
  miniaturaFoto: { width: "100%", height: "100%", backgroundColor: tema.lienzo },
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
  fotoFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
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
  ancho: { alignSelf: "stretch" },
  enviar: {
    height: 52,
    borderRadius: 14,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  apagado: { backgroundColor: tema.texto3 },
  enviarTexto: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
