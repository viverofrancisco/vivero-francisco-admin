import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as TextoNativo,
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
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import type { ArchivoLocal } from "@vivero/app-ui/lib/galeria";
import { RecortarFoto, type EdicionDeFoto } from "@/components/informes/RecortarFoto";
import { Lienzo, estiloDelTexto } from "@/components/camara/Lienzo";
import { BarraDeColor } from "@/components/camara/BarraDeColor";
import { MiniaturaDeVideo, cuadroDelVideo } from "@/components/MiniaturaDeVideo";
import { useAltoDelTeclado } from "@vivero/app-ui/lib/use-teclado";
import {
  FUENTES,
  LADO_ESTANDAR,
  POSICION_DEL_ROJO,
  colorEnLaBarra,
  conCalidad,
  enEdicion,
  medidasDe,
  recortar,
  tieneDibujos,
  type AlineacionDeTexto,
  type FondoDeTexto,
  type FotoEnEdicion,
  type TextoEnFoto,
  type Trazo,
} from "@/lib/edicion-de-fotos";

/** Lo que sigue a cada alineación y a cada fondo al tocar su botón. */
const SIGUIENTE_ALINEACION: Record<AlineacionDeTexto, AlineacionDeTexto> = {
  center: "left",
  left: "right",
  right: "center",
};
const SIGUIENTE_FONDO: Record<FondoDeTexto, FondoDeTexto> = {
  ninguno: "solido",
  solido: "suave",
  suave: "ninguno",
};
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
 * **lápiz**. Abajo, las miniaturas para pasar de una foto a otra (la ✕ de la
 * actual la quita) y el botón que termina. Abierto desde la cámara, la flecha de arriba y el + de las
 * miniaturas vuelven a ella sin perder lo editado. Un video pasa sin
 * herramientas: no hay nada que dibujarle.
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
  inicio = 0,
  memoria,
  onVolver,
  onQuitar,
  onCerrar,
  onListo,
}: {
  archivos: ArchivoLocal[];
  textoDeListo?: string;
  /** La foto que se abre primero (la que se tocó en la cámara). */
  inicio?: number;
  /** Lo editado de cada foto, por su `origen`: sobrevive a volver a la cámara y regresar. */
  memoria?: Map<string, FotoEnEdicion>;
  /**
   * Abierto desde la cámara: arriba una flecha que vuelve a ella sin perder
   * nada, y un + al final de las miniaturas para sacar más.
   */
  onVolver?: () => void;
  /** Se quitó una foto (por su `origen`): quien la eligió la saca de lo suyo. */
  onQuitar?: (origen: string) => void;
  onCerrar: () => void;
  onListo: (archivos: ArchivoLocal[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [fotos, setFotos] = useState<FotoEnEdicion[] | null>(null);
  const [actual, setActual] = useState(inicio);
  const [hd, setHd] = useState(false);
  const [herramienta, setHerramienta] = useState<Herramienta>(null);
  const [color, setColor] = useState(() => colorEnLaBarra(POSICION_DEL_ROJO));
  const [posicionDelColor, setPosicionDelColor] = useState(POSICION_DEL_ROJO);
  const [enCurso, setEnCurso] = useState<Trazo | null>(null);
  const [escribiendo, setEscribiendo] = useState<TextoEnFoto | null>(null);
  /** El ancho del texto que se escribe, medido aparte: un TextInput no se encoge solo. */
  const [anchoDelTexto, setAnchoDelTexto] = useState(0);
  const altoDelTeclado = useAltoDelTeclado();
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
    void Promise.all(archivos.map((a) => memoria?.get(a.uri) ?? enEdicion(a))).then((f) => {
      if (!vivo) return;
      setFotos(f);
      setActual((i) => Math.max(0, Math.min(i, f.length - 1)));
    });
    return () => {
      vivo = false;
    };
  }, [archivos, memoria]);

  // Lo editado queda guardado para cuando se vuelva de la cámara.
  useEffect(() => {
    for (const f of fotos ?? []) memoria?.set(f.origen, f);
  }, [fotos, memoria]);

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
      color: "#ffffff",
      posicionDelColor: 0,
      x: 0.5,
      y: 0.5,
      tamano: TAMANO_TEXTO,
      fuente: 0,
      alineacion: "center",
      fondo: "ninguno",
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
      // Unos cuadros para que el SVG y los textos, que se miden antes de
      // dibujarse, terminen encima de la foto.
      await new Promise((r) => setTimeout(r, 150));
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
        origen: f.origen,
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

  /** Quitar la foto actual. La última también: desde la cámara, se vuelve a ella sin esa foto. */
  function quitarActual() {
    if (!fotos) return;
    const quitada = fotos[actual];
    if (quitada) {
      memoria?.delete(quitada.origen);
      onQuitar?.(quitada.origen);
    }
    if (fotos.length === 1) {
      (onVolver ?? onCerrar)();
      return;
    }
    setFotos(fotos.filter((_, i) => i !== actual));
    setActual((i) => Math.max(0, Math.min(i, fotos.length - 2)));
  }

  // ── Pantalla ───────────────────────────────────────────────────────────────

  const dibujando = herramienta === "lapiz";

  return (
    // De borde a borde también abajo: la ventana llega al piso, así el alto del
    // teclado (que en Android cuenta la barra de navegación) y `insets.bottom`
    // se miden desde el mismo borde y nada queda levantado de más.
    <Modal visible animationType="fade" onRequestClose={onVolver ?? onCerrar} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.pantalla}>
        {/* Mientras se escribe, las barras del editor se esconden sin dejar
            su lugar, así la foto no se mueve. */}
        <View
          style={[styles.arriba, { paddingTop: insets.top + 8 }, escribiendo && styles.escondido]}
          pointerEvents={escribiendo ? "none" : "auto"}
        >
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
              {/* Desde la cámara se vuelve a ella (con todo lo sacado); si no, se cierra. */}
              {onVolver ? (
                <BotonDeEditor icono="arrow-back" etiqueta="Volver a la cámara" onPress={onVolver} />
              ) : (
                <BotonDeEditor icono="close" etiqueta="Cerrar" onPress={onCerrar} />
              )}
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
                <Lienzo
                  foto={foto}
                  ancho={caja.w}
                  alto={caja.h}
                  enCurso={enCurso}
                  sinElTexto={escribiendo?.id}
                />
              </View>
            </GestureDetector>
          ) : (
            <VideoEnEditor key={foto.archivo.uri} uri={foto.archivo.uri} ancho={caja.w} alto={caja.h} />
          )}
          {dibujando ? (
            <View style={styles.paleta}>
              <BarraDeColor
                posicion={posicionDelColor}
                onCambio={(p, c) => {
                  setPosicionDelColor(p);
                  setColor(c);
                }}
              />
            </View>
          ) : null}
        </View>

        {/* Abajo: las miniaturas y el botón que termina. */}
        <View
          style={[styles.abajoTodo, { paddingBottom: insets.bottom + 16 }, escribiendo && styles.escondido]}
          pointerEvents={escribiendo ? "none" : "auto"}
        >
          <View style={styles.abajo}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniaturas}>
              {(fotos ?? []).map((f, i) => (
                <Pressable
                  key={`${f.origen}-${i}`}
                  onPress={() => {
                    setHerramienta(null);
                    setActual(i);
                  }}
                  onLongPress={i === actual ? quitarActual : undefined}
                  style={[styles.miniatura, i === actual && styles.miniaturaActual]}
                  accessibilityLabel={`Foto ${i + 1}`}
                >
                  {f.archivo.tipo === "imagen" ? (
                    <Image source={{ uri: f.archivo.uri }} style={styles.miniaturaImagen} />
                  ) : (
                    <MiniaturaDeVideo uri={f.archivo.uri} style={styles.miniaturaImagen} tamanoDelPlay={14} />
                  )}
                  {i === actual ? (
                    <Pressable onPress={quitarActual} style={styles.quitar} hitSlop={6} accessibilityLabel="Quitar esta foto">
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  ) : null}
                </Pressable>
              ))}
              {/* Desde la cámara: volver a ella para sacar más. */}
              {onVolver ? (
                <Pressable
                  onPress={onVolver}
                  style={[styles.miniatura, styles.mas]}
                  accessibilityRole="button"
                  accessibilityLabel="Sacar más fotos"
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </Pressable>
              ) : null}
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
        </View>

        {trabajando ? (
          <View style={styles.cubierta}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.cubiertaTexto}>{trabajando}</Text>
          </View>
        ) : null}

        {escribiendo ? (
          // Las letras van pegadas al teclado. En Android el alto que da el
          // teclado no cuenta la barra de navegación, que también tapa.
          <View
            style={[
              styles.escribir,
              { paddingBottom: altoDelTeclado + (Platform.OS === "android" && altoDelTeclado > 0 ? insets.bottom : 0) },
            ]}
          >
            <View style={[styles.arriba, { paddingTop: insets.top + 8 }]}>
              <Pressable
                onPress={terminarTexto}
                style={[styles.boton, styles.botonActivo]}
                accessibilityRole="button"
                accessibilityLabel="Listo"
              >
                <Ionicons name="checkmark" size={24} color="#000" />
              </Pressable>
              <View style={[styles.flex, styles.herramientasDeTexto]}>
                <Pressable
                  onPress={() =>
                    setEscribiendo((t) => (t ? { ...t, alineacion: SIGUIENTE_ALINEACION[t.alineacion] } : t))
                  }
                  style={styles.boton}
                  accessibilityRole="button"
                  accessibilityLabel="Alineación"
                >
                  <MaterialCommunityIcons
                    name={
                      escribiendo.alineacion === "left"
                        ? "format-align-left"
                        : escribiendo.alineacion === "right"
                          ? "format-align-right"
                          : "format-align-center"
                    }
                    size={22}
                    color="#fff"
                  />
                </Pressable>
                <Pressable
                  onPress={() => setEscribiendo((t) => (t ? { ...t, fondo: SIGUIENTE_FONDO[t.fondo] } : t))}
                  style={[styles.boton, escribiendo.fondo !== "ninguno" && styles.botonActivo]}
                  accessibilityRole="button"
                  accessibilityLabel="Fondo del texto"
                >
                  <MaterialCommunityIcons
                    name={escribiendo.fondo === "suave" ? "alpha-a-box-outline" : "alpha-a-box"}
                    size={24}
                    color={escribiendo.fondo === "ninguno" ? "#fff" : "#000"}
                  />
                </Pressable>
              </View>
              {/* El mismo ancho que el ✓, para que los dos del medio queden al centro. */}
              <View style={styles.boton_espacio} />
            </View>

            <View style={styles.escribirCentro}>
              {(() => {
                const tamano = escribiendo.tamano * (caja?.w ?? 390);
                const estilo = estiloDelTexto(escribiendo, tamano);
                return (
                  <>
                    {/* Medido aparte para dar al campo el ancho de lo escrito. */}
                    <TextoNativo
                      allowFontScaling={false}
                      textBreakStrategy="simple"
                      style={[estilo.letra, styles.medida, { maxWidth: (caja?.w ?? 390) * 0.9 }]}
                      onLayout={(e) => setAnchoDelTexto(e.nativeEvent.layout.width)}
                    >
                      {escribiendo.texto || "Agrega texto"}
                    </TextoNativo>
                    <View style={estilo.caja}>
                      <TextInput
                        autoFocus
                        multiline
                        allowFontScaling={false}
                        value={escribiendo.texto}
                        onChangeText={(texto) => setEscribiendo((t) => (t ? { ...t, texto } : t))}
                        placeholder="Agrega texto"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        selectionColor="#25d366"
                        style={[estilo.letra, styles.campo, { width: anchoDelTexto + 6 }]}
                      />
                    </View>
                  </>
                );
              })()}
              <View style={styles.barraDelTexto}>
                <BarraDeColor
                  posicion={escribiendo.posicionDelColor}
                  onCambio={(p, c) =>
                    setEscribiendo((t) => (t ? { ...t, posicionDelColor: p, color: c } : t))
                  }
                />
              </View>
            </View>

            <ScrollView
              horizontal
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              style={styles.filaDeFuentes}
              contentContainerStyle={styles.fuentes}
            >
              {FUENTES.map((f, i) => {
                const elegida = escribiendo.fuente === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setEscribiendo((t) => (t ? { ...t, fuente: i } : t))}
                    style={[styles.fuente, elegida && styles.fuenteElegida]}
                    accessibilityRole="button"
                    accessibilityLabel={`Letra ${i + 1}`}
                  >
                    <TextoNativo
                      allowFontScaling={false}
                      style={[styles.fuenteTexto, f, elegida && styles.fuenteTextoElegida]}
                    >
                      Aa
                    </TextoNativo>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
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
  centroDelVideo: { alignItems: "center", justifyContent: "center" },
  playGrande: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  paleta: { position: "absolute", right: 8, top: 12 },
  abajoTodo: { paddingTop: 10, gap: 10 },
  abajo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
  },
  // El ✕ de la miniatura asoma 6 por arriba y a la derecha: sin este aire,
  // el ScrollView lo corta.
  miniaturas: { gap: 10, alignItems: "center", paddingTop: 8, paddingRight: 8, paddingLeft: 2 },
  // Un borde tenue en todas: una foto oscura no se pierde contra el fondo negro.
  miniatura: { width: 48, height: 48, borderRadius: 6, overflow: "visible", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  mas: { alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderColor: "rgba(255,255,255,0.6)" },
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
  // La foto se sigue viendo detrás, apenas oscurecida, como en WhatsApp.
  escribir: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  herramientasDeTexto: { flexDirection: "row", justifyContent: "center", gap: 12 },
  boton_espacio: { width: 40 },
  escribirCentro: { flex: 1, alignItems: "center", justifyContent: "center" },
  medida: { position: "absolute", opacity: 0, left: 0, top: 0 },
  campo: { padding: 0, margin: 0, textAlignVertical: "center" },
  barraDelTexto: { position: "absolute", right: 8, top: 8 },
  // Un ScrollView crece por defecto: sin esto se queda con la mitad del alto
  // libre y las letras flotan lejos del teclado.
  filaDeFuentes: { flexGrow: 0 },
  fuentes: { gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  fuente: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  fuenteElegida: { backgroundColor: "#fff" },
  fuenteTexto: { color: "#fff", fontSize: 17 },
  fuenteTextoElegida: { color: "#000" },
  escondido: { opacity: 0 },
  oculto: { position: "absolute", left: 0, top: 0, opacity: 0 },
});

/**
 * Un video en el editor, como en WhatsApp: el primer cuadro con un play
 * grande en el medio; tocar reproduce y vuelve a tocar pausa. No se dibuja
 * encima.
 *
 * `textureView` y no la `surfaceView` de siempre: el editor es un `Modal`, y
 * en Android una `SurfaceView` dentro de un `Modal` reproduce (los controles
 * avanzaban) pero no se ve, queda en negro.
 */
function VideoEnEditor({ uri, ancho, alto }: { uri: string; ancho: number; alto: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  // Hasta el primer play, el primer cuadro encima: la TextureView de Android
  // no dibuja nada antes de reproducir y quedaba un cuadro negro.
  const [cuadro, setCuadro] = useState<string | null>(null);
  const [empezo, setEmpezo] = useState(false);
  useEffect(() => {
    let vivo = true;
    void cuadroDelVideo(uri).then((c) => vivo && setCuadro(c));
    return () => {
      vivo = false;
    };
  }, [uri]);

  function alternar() {
    if (player.playing) {
      player.pause();
      return;
    }
    // Terminado, vuelve a empezar.
    if (player.duration > 0 && player.currentTime >= player.duration - 0.1) player.currentTime = 0;
    setEmpezo(true);
    player.play();
  }

  return (
    <Pressable onPress={alternar} accessibilityRole="button" accessibilityLabel={isPlaying ? "Pausar" : "Reproducir"}>
      <VideoView
        player={player}
        style={[styles.video, { width: ancho, height: alto }]}
        contentFit="contain"
        nativeControls={false}
        surfaceType="textureView"
      />
      {cuadro && !empezo ? (
        <Image
          source={{ uri: cuadro }}
          style={[StyleSheet.absoluteFill, { width: ancho, height: alto }]}
          resizeMode="contain"
          fadeDuration={0}
        />
      ) : null}
      {!isPlaying ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centroDelVideo]}>
          <View style={styles.playGrande}>
            <Ionicons name="play" size={40} color="#222" style={{ marginLeft: 5 }} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
