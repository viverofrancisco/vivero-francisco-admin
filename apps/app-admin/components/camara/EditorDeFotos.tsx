import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import type { ArchivoLocal } from "@vivero/app-ui/lib/galeria";
import { RecortarFoto, type EdicionDeFoto } from "@/components/informes/RecortarFoto";
import { Lienzo } from "@/components/camara/Lienzo";
import {
  LADO_ESTANDAR,
  conCalidad,
  enEdicion,
  medidasDe,
  recortar,
  tieneDibujos,
  type FotoEnEdicion,
  type TextoEnFoto,
  type Trazo,
} from "@/lib/edicion-de-fotos";

/** Los colores del lápiz y del texto, los de WhatsApp: blanco primero. */
const COLORES = ["#ffffff", "#000000", "#e53935", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"];
/** Grosor del lápiz y tamaño del texto, en fracción del ancho de la foto. */
const GROSOR = 0.012;
const TAMANO_TEXTO = 0.07;

type Herramienta = null | "lapiz";

/**
 * El editor de fotos, el de WhatsApp: se abre al sacar fotos con la cámara
 * propia o al elegirlas de la galería, antes de que lleguen a la bandeja.
 *
 * Arriba, las herramientas: **descargar** al teléfono, **HD** (la foto entera
 * en vez de bajada a 2048 de lado), **recortar y rotar** (`RecortarFoto`, la
 * misma pantalla de los informes, aplicada acá en el teléfono), **texto** y
 * **lápiz**. Abajo, las miniaturas para pasar de una foto a otra y el botón
 * que termina. Un video pasa sin herramientas: no hay nada que dibujarle.
 *
 * Lo dibujado se guarda en fracciones de la foto y se **aplana** recién al
 * terminar (`Lienzo` a la resolución de la foto, fuera de la vista, y
 * `react-native-view-shot`), así que cambiar de foto o deshacer no cuesta
 * nada. Lo que vuelve son archivos JPEG listos para subir, en el orden en que
 * llegaron; los que traían `assetId` lo conservan, para que la galería los
 * siga mostrando marcados.
 */
export function EditorDeFotos({
  archivos,
  textoDeListo = "Listo",
  onCerrar,
  onListo,
}: {
  archivos: ArchivoLocal[];
  textoDeListo?: string;
  onCerrar: () => void;
  onListo: (archivos: ArchivoLocal[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [fotos, setFotos] = useState<FotoEnEdicion[] | null>(null);
  const [actual, setActual] = useState(0);
  const [hd, setHd] = useState(false);
  const [herramienta, setHerramienta] = useState<Herramienta>(null);
  const [color, setColor] = useState(COLORES[2]);
  const [enCurso, setEnCurso] = useState<Trazo | null>(null);
  const [escribiendo, setEscribiendo] = useState<TextoEnFoto | null>(null);
  const [recortando, setRecortando] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  /** El texto que se está arrastrando, si se tocó uno. */
  const arrastrado = useRef<{ id: string; dx: number; dy: number } | null>(null);
  /** Lo que se está aplanando fuera de la vista. */
  const [aplanando, setAplanando] = useState<{
    foto: FotoEnEdicion;
    ancho: number;
    alto: number;
    listo: (uri: string | null) => void;
  } | null>(null);
  const lienzoOculto = useRef<View>(null);

  useEffect(() => {
    let vivo = true;
    void Promise.all(archivos.map(enEdicion)).then((f) => {
      if (vivo) setFotos(f);
    });
    return () => {
      vivo = false;
    };
  }, [archivos]);

  const foto = fotos?.[actual] ?? null;
  const esFoto = foto?.archivo.tipo === "imagen";

  /** La caja donde se dibuja la foto, entera y centrada en el área libre. */
  const caja = (() => {
    if (!foto || !area) return null;
    const escala = Math.min(area.w / foto.ancho, area.h / foto.alto);
    return { w: foto.ancho * escala, h: foto.alto * escala };
  })();

  function cambiarFoto(cambio: (f: FotoEnEdicion) => FotoEnEdicion) {
    setFotos((prev) => prev && prev.map((f, i) => (i === actual ? cambio(f) : f)));
  }

  // ── Lápiz y texto sobre la foto ────────────────────────────────────────────

  function textoEn(x: number, y: number): TextoEnFoto | null {
    if (!foto || !caja) return null;
    // De atrás para adelante: el último agregado está encima.
    for (const t of [...foto.textos].reverse()) {
      const lineas = t.texto.split("\n");
      const largo = Math.max(...lineas.map((l) => l.length), 1);
      const alto = (lineas.length * t.tamano * 1.2 * caja.w) / caja.h;
      const ancho = largo * t.tamano * 0.6;
      if (Math.abs(x - t.x) < ancho / 2 + 0.04 && Math.abs(y - t.y) < alto / 2 + 0.04) return t;
    }
    return null;
  }

  const gesto = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .enabled(Boolean(esFoto && caja))
    .onBegin((e) => {
      if (!caja) return;
      const p = { x: e.x / caja.w, y: e.y / caja.h };
      if (herramienta === "lapiz") {
        setEnCurso({ color, grosor: GROSOR, puntos: [p] });
        return;
      }
      const t = textoEn(p.x, p.y);
      arrastrado.current = t ? { id: t.id, dx: p.x - t.x, dy: p.y - t.y } : null;
    })
    .onUpdate((e) => {
      if (!caja) return;
      const p = {
        x: Math.min(Math.max(e.x / caja.w, 0), 1),
        y: Math.min(Math.max(e.y / caja.h, 0), 1),
      };
      if (herramienta === "lapiz") {
        setEnCurso((t) => (t ? { ...t, puntos: [...t.puntos, p] } : t));
        return;
      }
      const a = arrastrado.current;
      if (!a) return;
      cambiarFoto((f) => ({
        ...f,
        textos: f.textos.map((t) => (t.id === a.id ? { ...t, x: p.x - a.dx, y: p.y - a.dy } : t)),
      }));
    })
    .onFinalize(() => {
      if (herramienta === "lapiz") {
        setEnCurso((t) => {
          if (t) cambiarFoto((f) => ({ ...f, trazos: [...f.trazos, t] }));
          return null;
        });
      }
      arrastrado.current = null;
    });

  // Tocar un texto lo abre para corregirlo; tocar la foto con nada elegido, no
  // hace nada (el texto nuevo es el botón *Aa*).
  const toque = Gesture.Tap()
    .runOnJS(true)
    .enabled(Boolean(esFoto && caja && herramienta === null))
    .onEnd((e) => {
      if (!caja) return;
      const t = textoEn(e.x / caja.w, e.y / caja.h);
      if (t) setEscribiendo(t);
    });

  function deshacer() {
    cambiarFoto((f) => ({ ...f, trazos: f.trazos.slice(0, -1) }));
  }

  function nuevoTexto() {
    setHerramienta(null);
    setEscribiendo({
      id: `${Date.now()}`,
      texto: "",
      color: COLORES[0],
      x: 0.5,
      y: 0.5,
      tamano: TAMANO_TEXTO,
    });
  }

  function terminarTexto() {
    const t = escribiendo;
    setEscribiendo(null);
    if (!t) return;
    const limpio = t.texto.trim();
    cambiarFoto((f) => {
      const sinEste = f.textos.filter((x) => x.id !== t.id);
      // Vaciar el texto es borrarlo, como en WhatsApp.
      return { ...f, textos: limpio ? [...sinEste, { ...t, texto: limpio }] : sinEste };
    });
  }

  // ── Aplanar: los dibujos pasan a ser parte de la foto ─────────────────────

  /** La foto con lo dibujado, a su resolución (o a la estándar sin HD). */
  async function aplanar(f: FotoEnEdicion, enHd: boolean): Promise<ArchivoLocal> {
    if (f.archivo.tipo !== "imagen") return f.archivo;
    if (!tieneDibujos(f)) return conCalidad(f.archivo, enHd);
    const largo = Math.max(f.ancho, f.alto);
    const escala = enHd ? 1 : Math.min(1, LADO_ESTANDAR / largo);
    // En puntos, para que la captura salga en píxeles de la foto.
    const ancho = (f.ancho * escala) / PixelRatio.get();
    const alto = (f.alto * escala) / PixelRatio.get();
    const uri = await new Promise<string | null>((listo) =>
      setAplanando({ foto: f, ancho, alto, listo })
    );
    if (!uri) throw new Error("No pudimos preparar la foto.");
    const base = f.archivo.fileName.replace(/\.[^.]+$/, "") || `foto-${Date.now()}`;
    return { ...f.archivo, uri, fileName: `${base}.jpg`, contentType: "image/jpeg" };
  }

  async function capturarOculto() {
    const a = aplanando;
    if (!a) return;
    try {
      // Un cuadro para que el SVG termine de dibujar encima de la foto.
      await new Promise((r) => setTimeout(r, 60));
      const uri = await captureRef(lienzoOculto, {
        format: "jpg",
        quality: hd ? 0.92 : 0.8,
        result: "tmpfile",
      });
      a.listo(uri);
    } catch {
      a.listo(null);
    } finally {
      setAplanando(null);
    }
  }

  async function terminar() {
    if (!fotos) return;
    setTrabajando("Preparando…");
    try {
      const salida: ArchivoLocal[] = [];
      for (const f of fotos) salida.push(await aplanar(f, hd));
      onListo(salida);
    } catch {
      Alert.alert("No pudimos preparar las fotos", "Prueba otra vez.");
    } finally {
      setTrabajando(null);
    }
  }

  async function descargar() {
    if (!foto) return;
    setTrabajando("Guardando…");
    try {
      const permiso = await MediaLibrary.requestPermissionsAsync(true);
      if (!permiso.granted) {
        Alert.alert("Sin permiso", "Dale permiso a la app para guardar en tu galería.");
        return;
      }
      const archivo = await aplanar(foto, true);
      await MediaLibrary.saveToLibraryAsync(archivo.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Guardada", "La foto quedó en la galería del teléfono.");
    } catch {
      Alert.alert("No pudimos guardarla", "Prueba otra vez.");
    } finally {
      setTrabajando(null);
    }
  }

  async function alRecortar(edicion: EdicionDeFoto) {
    setRecortando(false);
    if (!foto) return;
    setTrabajando("Recortando…");
    try {
      // Lo dibujado se pega antes de recortar: un trazo en fracciones de la
      // foto entera ya no cae en su lugar sobre un pedazo de ella.
      const base = tieneDibujos(foto) ? await aplanar(foto, true) : foto.archivo;
      const uri = await recortar(base.uri, edicion);
      const { ancho, alto } = await medidasDe(uri);
      cambiarFoto((f) => ({
        archivo: { ...f.archivo, uri, contentType: "image/jpeg" },
        ancho,
        alto,
        trazos: [],
        textos: [],
      }));
    } catch {
      Alert.alert("No pudimos recortarla", "Prueba otra vez.");
    } finally {
      setTrabajando(null);
    }
  }

  function quitarActual() {
    if (!fotos) return;
    if (fotos.length === 1) {
      onCerrar();
      return;
    }
    setFotos(fotos.filter((_, i) => i !== actual));
    setActual((i) => Math.max(0, Math.min(i, fotos.length - 2)));
  }

  // ── Pantalla ───────────────────────────────────────────────────────────────

  const dibujando = herramienta === "lapiz";

  return (
    <Modal visible animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <GestureHandlerRootView style={styles.pantalla}>
        <View style={[styles.arriba, { paddingTop: insets.top + 8 }]}>
          {dibujando ? (
            <>
              <BotonDeEditor icono="arrow-undo" etiqueta="Deshacer" onPress={deshacer} disabled={!foto?.trazos.length} />
              <View style={styles.flex} />
              <Pressable onPress={() => setHerramienta(null)} style={styles.listoLapiz} accessibilityRole="button">
                <Text style={styles.listoLapizTexto}>Listo</Text>
              </Pressable>
            </>
          ) : (
            <>
              <BotonDeEditor icono="close" etiqueta="Cerrar" onPress={onCerrar} />
              <View style={styles.flex} />
              {esFoto ? (
                <>
                  <BotonDeEditor icono="download-outline" etiqueta="Descargar" onPress={() => void descargar()} />
                  <Pressable
                    onPress={() => setHd((v) => !v)}
                    style={[styles.boton, hd && styles.botonActivo]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: hd }}
                    accessibilityLabel="HD"
                  >
                    <MaterialCommunityIcons name="high-definition" size={24} color={hd ? "#000" : "#fff"} />
                  </Pressable>
                  <BotonDeEditor icono="crop" etiqueta="Recortar y rotar" onPress={() => setRecortando(true)} />
                  <Pressable onPress={nuevoTexto} style={styles.boton} accessibilityRole="button" accessibilityLabel="Texto">
                    <Text style={styles.aa}>Aa</Text>
                  </Pressable>
                  <BotonDeEditor icono="pencil" etiqueta="Lápiz" onPress={() => setHerramienta("lapiz")} />
                </>
              ) : null}
            </>
          )}
        </View>

        <View
          style={styles.area}
          onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {!foto || !caja ? (
            <ActivityIndicator color="#fff" />
          ) : esFoto ? (
            <GestureDetector gesture={Gesture.Exclusive(gesto, toque)}>
              <View>
                <Lienzo foto={foto} ancho={caja.w} alto={caja.h} enCurso={enCurso} />
              </View>
            </GestureDetector>
          ) : (
            <View style={[styles.video, { width: caja.w, height: caja.h }]}>
              <Ionicons name="play" size={48} color="#fff" />
            </View>
          )}
          {dibujando ? (
            <View style={styles.paleta}>
              {COLORES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.color, { backgroundColor: c }, color === c && styles.colorElegido]}
                  accessibilityLabel={`Color ${c}`}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.abajo, { paddingBottom: insets.bottom + 16 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniaturas}>
            {(fotos ?? []).map((f, i) => (
              <Pressable
                key={`${f.archivo.uri}-${i}`}
                onPress={() => {
                  setHerramienta(null);
                  setActual(i);
                }}
                onLongPress={i === actual ? quitarActual : undefined}
                style={[styles.miniatura, i === actual && styles.miniaturaActual]}
              >
                {f.archivo.tipo === "imagen" ? (
                  <Image source={{ uri: f.archivo.uri }} style={styles.miniaturaImagen} />
                ) : (
                  <View style={[styles.miniaturaImagen, styles.video]}>
                    <Ionicons name="play" size={14} color="#fff" />
                  </View>
                )}
                {i === actual && (fotos?.length ?? 0) > 0 ? (
                  <Pressable onPress={quitarActual} style={styles.quitar} hitSlop={6} accessibilityLabel="Quitar">
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => void terminar()}
            disabled={!fotos || Boolean(trabajando)}
            style={({ pressed }) => [styles.enviar, pressed && styles.tocado]}
            accessibilityRole="button"
            accessibilityLabel={textoDeListo}
          >
            <Ionicons name="checkmark" size={26} color="#fff" />
          </Pressable>
        </View>

        {trabajando ? (
          <View style={styles.cubierta}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.cubiertaTexto}>{trabajando}</Text>
          </View>
        ) : null}

        {escribiendo ? (
          <KeyboardAvoidingView behavior="padding" style={styles.escribir}>
            <View style={[styles.arriba, { paddingTop: insets.top + 8 }]}>
              <View style={styles.flex} />
              <Pressable onPress={terminarTexto} style={styles.listoLapiz} accessibilityRole="button">
                <Text style={styles.listoLapizTexto}>Listo</Text>
              </Pressable>
            </View>
            <View style={styles.escribirCentro}>
              <TextInput
                autoFocus
                multiline
                value={escribiendo.texto}
                onChangeText={(texto) => setEscribiendo((t) => (t ? { ...t, texto } : t))}
                placeholder="Escribe…"
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={[styles.campo, { color: escribiendo.color }]}
                textAlign="center"
              />
            </View>
            <View style={[styles.paletaFila, { paddingBottom: 12 }]}>
              {COLORES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setEscribiendo((t) => (t ? { ...t, color: c } : t))}
                  style={[styles.color, { backgroundColor: c }, escribiendo.color === c && styles.colorElegido]}
                  accessibilityLabel={`Color ${c}`}
                />
              ))}
            </View>
          </KeyboardAvoidingView>
        ) : null}

        {/* Donde se aplana: a la resolución de la foto, invisible. */}
        {aplanando ? (
          <View style={styles.oculto} pointerEvents="none">
            <Lienzo
              ref={lienzoOculto}
              foto={aplanando.foto}
              ancho={aplanando.ancho}
              alto={aplanando.alto}
              onCargada={() => void capturarOculto()}
            />
          </View>
        ) : null}

        {recortando && foto ? (
          <RecortarFoto
            url={foto.archivo.uri}
            comoWhatsApp
            onCerrar={() => setRecortando(false)}
            onGuardar={(e) => void alRecortar(e)}
          />
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function BotonDeEditor({
  icono,
  etiqueta,
  onPress,
  disabled = false,
}: {
  icono: React.ComponentProps<typeof Ionicons>["name"];
  etiqueta: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.boton, (pressed || disabled) && styles.tocado]}
      hitSlop={4}
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
  arriba: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  boton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  botonActivo: { backgroundColor: "#fff" },
  aa: { color: "#fff", fontSize: 17, fontWeight: "700" },
  tocado: { opacity: 0.5 },
  listoLapiz: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  listoLapizTexto: { color: "#000", fontSize: 14, fontWeight: "600" },
  area: { flex: 1, alignItems: "center", justifyContent: "center" },
  video: { alignItems: "center", justifyContent: "center", backgroundColor: "#222" },
  paleta: {
    position: "absolute",
    right: 12,
    top: 12,
    gap: 10,
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  paletaFila: { flexDirection: "row", justifyContent: "center", gap: 12 },
  color: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "rgba(255,255,255,0.7)" },
  colorElegido: { borderColor: "#fff", borderWidth: 3, transform: [{ scale: 1.15 }] },
  abajo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  // El ✕ de la miniatura asoma 6 por arriba y a la derecha: sin este aire,
  // el ScrollView lo corta.
  miniaturas: { gap: 10, alignItems: "center", paddingTop: 8, paddingRight: 8, paddingLeft: 2 },
  miniatura: { width: 48, height: 48, borderRadius: 6, overflow: "visible" },
  miniaturaActual: { borderWidth: 2, borderColor: "#fff" },
  miniaturaImagen: { width: "100%", height: "100%", borderRadius: 5 },
  quitar: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c8393a",
  },
  enviar: {
    marginLeft: "auto",
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2d7b48",
  },
  cubierta: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cubiertaTexto: { color: "#fff", fontSize: 14 },
  escribir: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)" },
  escribirCentro: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  campo: { fontSize: 30, fontWeight: "700" },
  oculto: { position: "absolute", left: 0, top: 0, opacity: 0 },
});
