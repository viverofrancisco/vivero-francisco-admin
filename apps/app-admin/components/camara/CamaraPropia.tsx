import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
  type FlashMode,
} from "expo-camera";
import {
  GALERIA_PROPIA,
  archivoDeAssetDeGaleria,
  type ArchivoLocal,
} from "@vivero/app-ui/lib/galeria";
import { EditorDeFotos } from "@/components/camara/EditorDeFotos";

const FLASHES: FlashMode[] = ["off", "auto", "on"];
const ICONO_FLASH: Record<FlashMode, React.ComponentProps<typeof Ionicons>["name"]> = {
  off: "flash-off",
  auto: "flash-outline",
  on: "flash",
};
/** Cuántas de las últimas fotos del teléfono muestra la tira de abajo. */
const RECIENTES = 30;

/**
 * La cámara de la app, la de WhatsApp: se abre dentro de la app, saca varias
 * seguidas sin salir, y abajo muestra una tira con las últimas fotos del
 * teléfono para sumar alguna de un toque. Al terminar abre el editor
 * (`EditorDeFotos`) con todo lo elegido, y lo que vuelve de ahí es lo que
 * recibe `onListo`.
 *
 * Reemplaza a la cámara del sistema (`launchCameraAsync`), que sacaba de a
 * una y devolvía la foto sin pasar por ningún editor. La tira de recientes
 * necesita el permiso de la galería, así que en Android sale solo donde la
 * app lo tiene (`GALERIA_PROPIA`), y nunca lo pide: si no se dio, no hay
 * tira y la cámara funciona igual.
 */
export function CamaraPropia({
  conVideos = false,
  maximo,
  textoDeListo,
  onCerrar,
  onListo,
}: {
  /** El chat manda videos; la visita y la novedad, fotos y videos o solo fotos. */
  conVideos?: boolean;
  /** Cuántas caben todavía. */
  maximo: number;
  textoDeListo?: string;
  onCerrar: () => void;
  onListo: (archivos: ArchivoLocal[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const camara = useRef<CameraView>(null);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [, pedirMicrofono] = useMicrophonePermissions();
  const [lado, setLado] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [modo, setModo] = useState<"picture" | "video">("picture");
  const [grabando, setGrabando] = useState(false);
  const [sacando, setSacando] = useState(false);
  const [lista, setLista] = useState(false);
  const [elegidos, setElegidos] = useState<ArchivoLocal[]>([]);
  const [recientes, setRecientes] = useState<MediaLibrary.Asset[]>([]);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (permiso && !permiso.granted && permiso.canAskAgain) void pedirPermiso();
  }, [permiso, pedirPermiso]);

  useEffect(() => {
    if (!GALERIA_PROPIA) return;
    let vivo = true;
    void (async () => {
      const p = await MediaLibrary.getPermissionsAsync(false, ["photo", "video"]);
      if (!p.granted) return;
      const pagina = await MediaLibrary.getAssetsAsync({
        first: RECIENTES,
        mediaType: conVideos
          ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
          : [MediaLibrary.MediaType.photo],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      if (vivo) setRecientes(pagina.assets);
    })().catch(() => {});
    return () => {
      vivo = false;
    };
  }, [conVideos]);

  const lleno = elegidos.length >= maximo;

  function sumar(archivo: ArchivoLocal) {
    setAviso(null);
    setElegidos((prev) => {
      if (prev.length >= maximo) {
        setAviso(`Hasta ${maximo} ${maximo === 1 ? "archivo" : "archivos"} por vez.`);
        return prev;
      }
      return [...prev, archivo];
    });
  }

  async function disparar() {
    if (!camara.current || !lista || sacando) return;
    if (lleno) {
      setAviso(`Hasta ${maximo} ${maximo === 1 ? "archivo" : "archivos"} por vez.`);
      return;
    }
    if (modo === "video") {
      if (grabando) {
        camara.current.stopRecording();
        return;
      }
      const mic = await pedirMicrofono();
      if (!mic.granted) {
        setAviso("Para grabar con sonido, dale permiso al micrófono en los ajustes.");
      }
      setGrabando(true);
      try {
        const video = await camara.current.recordAsync({ maxDuration: 120 });
        if (video?.uri) {
          sumar({
            uri: video.uri,
            fileName: `video-${Date.now()}.mp4`,
            contentType: "video/mp4",
            tipo: "video",
          });
        }
      } catch {
        setAviso("No pudimos grabar el video.");
      } finally {
        setGrabando(false);
      }
      return;
    }
    setSacando(true);
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.9 });
      if (foto?.uri) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sumar({
          uri: foto.uri,
          fileName: `foto-${Date.now()}.jpg`,
          contentType: "image/jpeg",
          tipo: "imagen",
        });
      }
    } catch {
      setAviso("No pudimos sacar la foto.");
    } finally {
      setSacando(false);
    }
  }

  async function alternarReciente(a: MediaLibrary.Asset) {
    const ya = elegidos.find((e) => e.assetId === a.id);
    if (ya) {
      setElegidos((prev) => prev.filter((e) => e.assetId !== a.id));
      return;
    }
    try {
      sumar(await archivoDeAssetDeGaleria(a));
    } catch {
      setAviso("No pudimos abrir esa foto.");
    }
  }

  if (editando) {
    return (
      <EditorDeFotos
        archivos={elegidos}
        textoDeListo={textoDeListo}
        // Cerrar el editor vuelve a la cámara con lo sacado, no lo tira.
        onCerrar={() => setEditando(false)}
        onListo={onListo}
      />
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={styles.pantalla}>
        {!permiso ? (
          <View style={styles.centro}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permiso.granted ? (
          <View style={styles.centro}>
            <Ionicons name="camera-outline" size={44} color="#fff" />
            <Text style={styles.sinPermiso}>
              Para sacar fotos, dale permiso a la cámara en los ajustes del teléfono.
            </Text>
            <Pressable onPress={() => Linking.openSettings()} style={styles.ajustes}>
              <Text style={styles.ajustesTexto}>Abrir ajustes</Text>
            </Pressable>
            <Pressable onPress={onCerrar} style={styles.cerrarAbajo}>
              <Text style={styles.cerrarAbajoTexto}>Cerrar</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            ref={camara}
            style={StyleSheet.absoluteFill}
            facing={lado}
            flash={flash}
            mode={modo}
            onCameraReady={() => setLista(true)}
          />
        )}

        <View style={[styles.arriba, { paddingTop: insets.top + 8 }]}>
          <Boton icono="close" etiqueta="Cerrar" onPress={onCerrar} />
          <View style={styles.flex} />
          {modo === "picture" ? (
            <Boton
              icono={ICONO_FLASH[flash]}
              etiqueta="Flash"
              onPress={() => setFlash((f) => FLASHES[(FLASHES.indexOf(f) + 1) % FLASHES.length])}
            />
          ) : null}
        </View>

        {grabando ? (
          <View style={[styles.grabando, { top: insets.top + 60 }]}>
            <View style={styles.puntoRojo} />
            <Text style={styles.grabandoTexto}>Grabando</Text>
          </View>
        ) : null}

        <View style={[styles.abajo, { paddingBottom: insets.bottom + 16 }]}>
          {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

          {recientes.length > 0 && !grabando ? (
            <FlatList
              horizontal
              data={recientes}
              keyExtractor={(a) => a.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recientes}
              renderItem={({ item: a }) => {
                const marcado = elegidos.some((e) => e.assetId === a.id);
                return (
                  <Pressable onPress={() => void alternarReciente(a)} style={styles.reciente}>
                    <Image source={{ uri: a.uri }} style={styles.recienteImagen} />
                    {marcado ? (
                      <View style={styles.recienteMarca}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          ) : null}

          <View style={styles.controles}>
            {/* A la izquierda, lo ya sacado: tocarlo es ir al editor. */}
            <Pressable
              onPress={() => elegidos.length > 0 && setEditando(true)}
              style={styles.lado}
              disabled={elegidos.length === 0}
              accessibilityLabel="Ver lo sacado"
            >
              {elegidos.length > 0 ? (
                <View>
                  {elegidos[elegidos.length - 1].tipo === "imagen" ? (
                    <Image source={{ uri: elegidos[elegidos.length - 1].uri }} style={styles.ultima} />
                  ) : (
                    <View style={[styles.ultima, styles.ultimaVideo]}>
                      <Ionicons name="videocam" size={18} color="#fff" />
                    </View>
                  )}
                  <View style={styles.cuenta}>
                    <Text style={styles.cuentaTexto}>{elegidos.length}</Text>
                  </View>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => void disparar()}
              disabled={!lista}
              style={({ pressed }) => [styles.disparador, pressed && styles.tocado]}
              accessibilityRole="button"
              accessibilityLabel={modo === "video" ? (grabando ? "Detener" : "Grabar") : "Sacar foto"}
            >
              <View
                style={[
                  styles.disparadorCentro,
                  modo === "video" && styles.disparadorVideo,
                  grabando && styles.disparadorGrabando,
                ]}
              />
            </Pressable>

            <View style={styles.lado}>
              {elegidos.length > 0 && !grabando ? (
                <Pressable
                  onPress={() => setEditando(true)}
                  style={({ pressed }) => [styles.siguiente, pressed && styles.tocado]}
                  accessibilityRole="button"
                  accessibilityLabel="Siguiente"
                >
                  <Ionicons name="arrow-forward" size={24} color="#fff" />
                </Pressable>
              ) : !grabando ? (
                <Boton
                  icono="camera-reverse-outline"
                  etiqueta="Cambiar de cámara"
                  onPress={() => setLado((l) => (l === "back" ? "front" : "back"))}
                />
              ) : null}
            </View>
          </View>

          {conVideos && !grabando ? (
            <View style={styles.modos}>
              {(["video", "picture"] as const).map((m) => (
                <Pressable key={m} onPress={() => setModo(m)} hitSlop={8}>
                  <Text style={[styles.modo, modo === m && styles.modoActivo]}>
                    {m === "video" ? "Video" : "Foto"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Boton({
  icono,
  etiqueta,
  onPress,
}: {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  etiqueta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.boton, pressed && styles.tocado]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Ionicons name={icono} size={22} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
  sinPermiso: { color: "#fff", fontSize: 15, textAlign: "center" },
  ajustes: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 16, height: 36, justifyContent: "center" },
  ajustesTexto: { color: "#000", fontWeight: "600" },
  cerrarAbajo: { padding: 8 },
  cerrarAbajoTexto: { color: "#fff" },
  arriba: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  boton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  tocado: { opacity: 0.6 },
  grabando: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  puntoRojo: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e53935" },
  grabandoTexto: { color: "#fff", fontSize: 13, fontWeight: "600" },
  abajo: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 12 },
  aviso: {
    alignSelf: "center",
    color: "#fff",
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  recientes: { gap: 4, paddingHorizontal: 12 },
  reciente: { width: 64, height: 64 },
  recienteImagen: { width: 64, height: 64, borderRadius: 4 },
  recienteMarca: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2d7b48",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  controles: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  lado: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  ultima: { width: 48, height: 48, borderRadius: 8, borderWidth: 2, borderColor: "#fff" },
  ultimaVideo: { alignItems: "center", justifyContent: "center", backgroundColor: "#333" },
  cuenta: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2d7b48",
  },
  cuentaTexto: { color: "#fff", fontSize: 12, fontWeight: "700" },
  disparador: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  disparadorCentro: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },
  disparadorVideo: { backgroundColor: "#e53935" },
  disparadorGrabando: { width: 28, height: 28, borderRadius: 6 },
  siguiente: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2d7b48",
  },
  modos: { flexDirection: "row", justifyContent: "center", gap: 24, paddingBottom: 4 },
  modo: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600" },
  modoActivo: { color: "#fdd835" },
});
