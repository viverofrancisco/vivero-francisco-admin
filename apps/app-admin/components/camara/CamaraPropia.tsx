import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
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
import { MiniaturaDeVideo } from "@/components/MiniaturaDeVideo";
import type { FotoEnEdicion } from "@/lib/edicion-de-fotos";

const FLASHES: FlashMode[] = ["off", "auto", "on"];
const ICONO_FLASH: Record<FlashMode, React.ComponentProps<typeof Ionicons>["name"]> = {
  off: "flash-off",
  auto: "flash-outline",
  on: "flash",
};
/** Cuántas de las últimas fotos del teléfono muestra la tira de abajo. */
const RECIENTES = 30;
/** El cuadrito amarillo que marca dónde se enfocó. */
const LADO_DEL_ENFOQUE = 72;

/**
 * La cámara de la app, la de WhatsApp: se abre dentro de la app, saca varias
 * seguidas sin salir, y abajo muestra una tira con lo ya sacado (cada una con
 * su ✕ para quitarla; tocarla la abre en el editor) seguido de las últimas
 * fotos del teléfono para sumar alguna de un toque. Al terminar abre el editor
 * (`EditorDeFotos`) con todo lo elegido, y lo que vuelve de ahí es lo que
 * recibe `onListo`. Del editor se vuelve a la cámara (la flecha, o el + de las
 * miniaturas) sin perder nada: lo editado queda guardado por foto.
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
  /** Segundos grabados, para el reloj rojo de arriba. */
  const [segundos, setSegundos] = useState(0);
  const [sacando, setSacando] = useState(false);
  const [lista, setLista] = useState(false);
  const [elegidos, setElegidos] = useState<ArchivoLocal[]>([]);
  const [recientes, setRecientes] = useState<MediaLibrary.Asset[]>([]);
  /** El editor abierto, en la foto que se tocó. */
  const [editando, setEditando] = useState<number | null>(null);
  /** Lo dibujado, escrito y recortado de cada foto, para volver al editor tal como se dejó. */
  const ediciones = useRef(new Map<string, FotoEnEdicion>()).current;
  const [aviso, setAviso] = useState<string | null>(null);
  /** El zoom de la barra, de 0 (sin zoom) a 1 (el máximo del teléfono). */
  const [zoom, setZoom] = useState(0);
  const [pellizcando, setPellizcando] = useState(false);
  const zoomAlEmpezar = useRef(0);
  /** El aumento máximo de la cámara, que en Android cuenta el pellizco nativo. */
  const [aumentoMaximo, setAumentoMaximo] = useState(AUMENTO_MAXIMO);
  const finDelPellizco = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Dónde se tocó para enfocar: el cuadrito amarillo de la cámara del teléfono. */
  const [enfoque, setEnfoque] = useState<{ x: number; y: number; vez: number } | null>(null);
  const brilloDelEnfoque = useRef(new Animated.Value(0)).current;
  /**
   * Las de la tira que se tocaron y todavía se están abriendo: se ven
   * marcadas al instante, y un segundo toque mientras tanto no las suma de
   * nuevo (antes cada toque agregaba otra copia de la misma).
   */
  const [abriendo, setAbriendo] = useState<string[]>([]);
  const elegidosRef = useRef(elegidos);
  elegidosRef.current = elegidos;
  const abriendoRef = useRef(abriendo);
  abriendoRef.current = abriendo;

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

  useEffect(() => {
    if (!grabando) return;
    setSegundos(0);
    const desde = Date.now();
    const reloj = setInterval(() => setSegundos(Math.floor((Date.now() - desde) / 1000)), 250);
    return () => clearInterval(reloj);
  }, [grabando]);

  const lleno = elegidos.length >= maximo;

  // Pellizcar acerca o aleja, también grabando, como en WhatsApp. La barra va
  // en escala logarítmica (ver `zoomDeLaCamara`), así que abrir los dedos al
  // doble duplica el aumento, empiece donde empiece: lo que estaba entre los
  // dedos se queda entre los dedos.
  const pellizco = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      zoomAlEmpezar.current = zoom;
      setPellizcando(true);
    })
    .onUpdate((e) => {
      const z = zoomAlEmpezar.current + Math.log(e.scale) / Math.log(AUMENTO_MAXIMO);
      setZoom(Math.min(1, Math.max(0, Math.round(z * 200) / 200)));
    })
    .onFinalize(() => setPellizcando(false));

  /**
   * En Android el pellizco lo hace la cámara misma (parche a expo-camera, ver
   * `patches/`): cada cuadro va directo a CameraX y acá solo llega el aumento
   * resultante, para que la barra lo siga. Pasado por JS, el zoom iba detrás
   * de los dedos.
   */
  function alZoomNativo(e: { nativeEvent: { ratio: number; maximo: number } }) {
    const { ratio, maximo } = e.nativeEvent;
    if (maximo > 1) setAumentoMaximo(maximo);
    const z = maximo > 1 ? Math.log(Math.max(1, ratio)) / Math.log(maximo) : 0;
    setZoom(Math.min(1, Math.max(0, z)));
    setPellizcando(true);
    if (finDelPellizco.current) clearTimeout(finDelPellizco.current);
    finDelPellizco.current = setTimeout(() => setPellizcando(false), 800);
  }

  /** El toque enfoca y mide la luz ahí (en nativo); acá se dibuja el cuadrito. */
  function alEnfocar(e: { nativeEvent: { x: number; y: number } }) {
    setEnfoque({ x: e.nativeEvent.x, y: e.nativeEvent.y, vez: Date.now() });
    brilloDelEnfoque.setValue(1);
    Animated.timing(brilloDelEnfoque, {
      toValue: 0,
      duration: 400,
      delay: 900,
      useNativeDriver: true,
    }).start();
  }

  useEffect(
    () => () => {
      if (finDelPellizco.current) clearTimeout(finDelPellizco.current);
    },
    []
  );

  function sumar(archivo: ArchivoLocal) {
    setAviso(null);
    setElegidos((prev) => {
      if (archivo.assetId && prev.some((e) => e.assetId === archivo.assetId)) return prev;
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

  // Estables (leen por ref), para que la tira no se vuelva a dibujar con
  // cada cuadro del zoom o cada segundo del reloj.
  const alternarReciente = useCallback(
    async (a: MediaLibrary.Asset) => {
      if (abriendoRef.current.includes(a.id)) return;
      const ya = elegidosRef.current.find((e) => e.assetId === a.id);
      if (ya) {
        ediciones.delete(ya.uri);
        setElegidos((prev) => prev.filter((e) => e.uri !== ya.uri));
        return;
      }
      setAbriendo((prev) => [...prev, a.id]);
      try {
        // Sin pasar a JPEG: el editor ya lo hace al terminar.
        sumar(await archivoDeAssetDeGaleria(a, { sinConvertir: true }));
      } catch {
        setAviso("No pudimos abrir esa foto.");
      } finally {
        setAbriendo((prev) => prev.filter((id) => id !== a.id));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const quitar = useCallback(
    (uri: string) => {
      ediciones.delete(uri);
      setElegidos((prev) => prev.filter((e) => e.uri !== uri));
    },
    [ediciones]
  );

  const marcados = useMemo(
    () => new Set([...elegidos.flatMap((e) => (e.assetId ? [e.assetId] : [])), ...abriendo]),
    [elegidos, abriendo]
  );

  // Lo sacado con esta cámara; lo elegido de la tira de recientes se ve marcado en ella.
  const tomados = useMemo(
    () => elegidos.flatMap((e, i) => (e.assetId ? [] : [{ e, i }])),
    [elegidos]
  );

  if (editando !== null) {
    return (
      <EditorDeFotos
        archivos={elegidos}
        inicio={editando}
        memoria={ediciones}
        textoDeListo={textoDeListo}
        // Volver (la flecha, el + o quitar la última) es a la cámara con lo sacado, no tirarlo.
        onVolver={() => setEditando(null)}
        onQuitar={quitar}
        onCerrar={() => setEditando(null)}
        onListo={onListo}
      />
    );
  }


  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      {/* Un Modal es su propia ventana: sin esto, en Android el pellizco no llega. */}
      <GestureHandlerRootView style={styles.pantalla}>
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
          // En Android el pellizco y el toque los atiende la cámara nativa, y
          // un GestureDetector encima se los quitaría; en iOS el pellizco
          // sigue siendo el de gesture-handler.
          <ConPellizco gesto={GESTOS_NATIVOS ? null : pellizco}>
            <View style={StyleSheet.absoluteFill}>
              <CameraView
                ref={camara}
                style={StyleSheet.absoluteFill}
                facing={lado}
                flash={flash}
                mode={modo}
                zoom={zoomDeLaCamara(zoom, aumentoMaximo)}
                onCameraReady={() => setLista(true)}
                // Eventos del parche: CameraView los pasa tal cual a la vista nativa.
                {...({ onZoomNativo: alZoomNativo, onEnfocar: alEnfocar } as object)}
              />
              {enfoque ? (
                <Animated.View
                  key={enfoque.vez}
                  pointerEvents="none"
                  style={[
                    styles.enfoque,
                    {
                      left: enfoque.x - LADO_DEL_ENFOQUE / 2,
                      top: enfoque.y - LADO_DEL_ENFOQUE / 2,
                      opacity: brilloDelEnfoque,
                      transform: [
                        {
                          scale: brilloDelEnfoque.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.9, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
            </View>
          </ConPellizco>
        )}

        <View
          style={[styles.arriba, { paddingTop: insets.top + 8 }, grabando && styles.escondido]}
          pointerEvents={grabando ? "none" : "auto"}
        >
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
          <View style={[styles.grabando, { top: insets.top + 12 }]}>
            <Text style={styles.grabandoTexto}>{reloj(segundos)}</Text>
          </View>
        ) : null}

        <View style={[styles.abajo, { paddingBottom: insets.bottom + 16 }]}>
          {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

          {pellizcando || zoom > 0 || grabando ? (
            <BarraDeZoom zoom={zoom} onCambio={setZoom} />
          ) : null}

          {(recientes.length > 0 || tomados.length > 0) && !grabando ? (
            <TiraDeLaCamara
              recientes={recientes}
              tomados={tomados}
              marcados={marcados}
              onTocarReciente={alternarReciente}
              onEditar={setEditando}
              onQuitar={quitar}
            />
          ) : null}

          <View style={styles.controles}>
            {/* Lo sacado está en la tira de arriba; a la izquierda queda cambiar de cámara. */}
            <View style={styles.lado}>
              {!grabando ? (
                <Boton
                  icono="camera-reverse-outline"
                  etiqueta="Cambiar de cámara"
                  onPress={() => setLado((l) => (l === "back" ? "front" : "back"))}
                />
              ) : null}
            </View>

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
              {grabando && CAMBIA_GRABANDO ? (
                <Boton
                  icono="camera-reverse-outline"
                  etiqueta="Cambiar de cámara"
                  onPress={() => setLado((l) => (l === "back" ? "front" : "back"))}
                />
              ) : elegidos.length > 0 && !grabando ? (
                <Pressable
                  onPress={() => setEditando(0)}
                  style={({ pressed }) => [styles.siguiente, pressed && styles.tocado]}
                  accessibilityRole="button"
                  accessibilityLabel="Siguiente"
                >
                  <Ionicons name="arrow-forward" size={24} color="#fff" />
                  <View style={styles.cuenta}>
                    <Text style={styles.cuentaTexto}>{elegidos.length}</Text>
                  </View>
                </Pressable>
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
      </GestureHandlerRootView>
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
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#d0103a",
  },
  escondido: { opacity: 0 },
  zoom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  zoomPista: { flex: 1, height: 32, justifyContent: "center" },
  zoomLinea: { height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.85)" },
  zoomPunto: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#ffd60a",
  },
  grabandoTexto: { color: "#fff", fontSize: 17, fontWeight: "500", fontVariant: ["tabular-nums"] },
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
  // Aire arriba y a la derecha para la ✕ de lo sacado, que asoma del borde.
  recientes: { gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  tomados: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 4 },
  tomado: { width: 64, height: 64 },
  tomadoImagen: { width: 64, height: 64, borderRadius: 6, borderWidth: 2, borderColor: "#fff" },
  tomadoQuitar: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c8393a",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  separador: { width: 1, height: 44, marginLeft: 4, backgroundColor: "rgba(255,255,255,0.5)" },
  reciente: { width: 64, height: 64 },
  recienteImagen: { width: 64, height: 64, borderRadius: 4 },
  recienteVideo: { position: "absolute", left: 4, bottom: 4 },
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
    backgroundColor: "#fff",
  },
  cuentaTexto: { color: "#2d7b48", fontSize: 12, fontWeight: "700" },
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
  disparadorGrabando: { width: 30, height: 30, borderRadius: 7 },
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
  enfoque: {
    position: "absolute",
    width: LADO_DEL_ENFOQUE,
    height: LADO_DEL_ENFOQUE,
    borderWidth: 1.5,
    borderColor: "#ffd60a",
    borderRadius: 4,
  },
});

/**
 * Cuánto aumenta la barra entera: de 1× a 10×, el máximo digital habitual de
 * un Android. La barra y el pellizco van en escala **logarítmica** —el medio
 * es ~3×—, como en WhatsApp: en lineal el primer tramo saltaba de 1× a 2× en
 * un pelo y el resto se arrastraba.
 */
const AUMENTO_MAXIMO = 10;

/**
 * El zoom que se le pasa a la cámara. En Android expo-camera lo toma lineal
 * (`fracción × máximo`, nunca menos de 1×), así que se pasa el aumento
 * buscado sobre el máximo —el real, que cuenta el pellizco nativo, o
 * `AUMENTO_MAXIMO` hasta saberlo—: 0 queda en 1×. En iOS expo-camera ya lo
 * aplica exponencial (`mínimo × (máximo / mínimo) ^ zoom`) y se pasa tal cual.
 */
function zoomDeLaCamara(z: number, maximo: number): number {
  if (Platform.OS !== "android") return z;
  return Math.pow(maximo, z) / maximo;
}

/**
 * Si el pellizco y el toque para enfocar los hace la cámara nativa. En
 * Android sí, por el parche a expo-camera; en iOS no hay toque para enfocar
 * y el pellizco va por gesture-handler.
 */
const GESTOS_NATIVOS = Platform.OS === "android";

function ConPellizco({
  gesto,
  children,
}: {
  gesto: ReturnType<typeof Gesture.Pinch> | null;
  children: React.ReactElement;
}) {
  return gesto ? <GestureDetector gesture={gesto}>{children}</GestureDetector> : children;
}

/**
 * La tira de abajo: primero lo sacado (tocarla la abre en el editor, la ✕ la
 * quita) y después las últimas del teléfono, que se marcan de un toque. Va
 * aparte y memorizada porque la cámara se vuelve a dibujar con cada cuadro
 * del pellizco: treinta fotos redibujándose ahí hacían que todo respondiera
 * tarde. `expo-image` y no la `Image` de React Native, que decodifica cada
 * una de 12 megapíxeles entera para mostrarla en 64 puntos.
 */
const TiraDeLaCamara = memo(function TiraDeLaCamara({
  recientes,
  tomados,
  marcados,
  onTocarReciente,
  onEditar,
  onQuitar,
}: {
  recientes: MediaLibrary.Asset[];
  tomados: { e: ArchivoLocal; i: number }[];
  marcados: Set<string>;
  onTocarReciente: (a: MediaLibrary.Asset) => void;
  onEditar: (i: number) => void;
  onQuitar: (uri: string) => void;
}) {
  return (
    <FlatList
      horizontal
      data={recientes}
      extraData={marcados}
      keyExtractor={(a) => a.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.recientes}
      ListHeaderComponent={
        tomados.length > 0 ? (
          <View style={styles.tomados}>
            {tomados.map(({ e, i }) => (
              <Pressable
                key={e.uri}
                onPress={() => onEditar(i)}
                style={styles.tomado}
                accessibilityLabel={`Editar la foto ${i + 1}`}
              >
                {e.tipo === "imagen" ? (
                  <Image source={{ uri: e.uri }} style={styles.tomadoImagen} />
                ) : (
                  <MiniaturaDeVideo uri={e.uri} style={styles.tomadoImagen} />
                )}
                <Pressable
                  onPress={() => onQuitar(e.uri)}
                  hitSlop={8}
                  style={styles.tomadoQuitar}
                  accessibilityLabel="Quitar"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
              </Pressable>
            ))}
            {recientes.length > 0 ? <View style={styles.separador} /> : null}
          </View>
        ) : null
      }
      renderItem={({ item: a }) => (
        <Pressable onPress={() => onTocarReciente(a)} style={styles.reciente}>
          <Image source={{ uri: a.uri }} style={styles.recienteImagen} recyclingKey={a.id} />
          {a.mediaType === "video" ? (
            <View style={styles.recienteVideo}>
              <Ionicons name="play" size={12} color="#fff" />
            </View>
          ) : null}
          {marcados.has(a.id) ? (
            <View style={styles.recienteMarca}>
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
});

/** La barra de WhatsApp: − y + a los lados, el punto donde está el zoom; se arrastra también. */
function BarraDeZoom({ zoom, onCambio }: { zoom: number; onCambio: (z: number) => void }) {
  const [ancho, setAncho] = useState(0);
  const arrastre = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => ancho > 0 && onCambio(Math.min(1, Math.max(0, e.x / ancho))))
    .onUpdate((e) => ancho > 0 && onCambio(Math.min(1, Math.max(0, e.x / ancho))));
  return (
    <View style={styles.zoom}>
      <Pressable onPress={() => onCambio(Math.max(0, zoom - 0.1))} hitSlop={10} accessibilityLabel="Alejar">
        <Ionicons name="remove" size={22} color="#fff" />
      </Pressable>
      <GestureDetector gesture={arrastre}>
        <View style={styles.zoomPista} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
          <View style={styles.zoomLinea} />
          <View style={[styles.zoomPunto, { left: zoom * ancho - 9 }]} />
        </View>
      </GestureDetector>
      <Pressable onPress={() => onCambio(Math.min(1, zoom + 0.1))} hitSlop={10} accessibilityLabel="Acercar">
        <Ionicons name="add" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

/**
 * Si se puede cambiar de cámara grabando. En Android sí: expo-camera va con un
 * parche (`patches/expo-camera+*.patch`) que hace la grabación persistente y
 * reusa la misma VideoCapture, así que sigue en la otra cámara. En iOS la
 * librería corta la grabación al cambiar la entrada.
 */
const CAMBIA_GRABANDO = Platform.OS === "android";

/** "00:13" del reloj rojo de arriba mientras se graba. */
function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
