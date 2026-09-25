import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export type Rotacion = 0 | 90 | 180 | 270;

/** Lo que se le pide al servidor: el mismo cuerpo que el editor del portal. */
export interface EdicionDeFoto {
  recorte: { x: number; y: number; ancho: number; alto: number };
  rotar: Rotacion;
  voltear: boolean;
}

/** El recuadro, en **fracciones** de la imagen ya volteada y girada. */
interface Recuadro {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Estado {
  recuadro: Recuadro;
  rotar: Rotacion;
  voltear: boolean;
  forma: string;
}

/**
 * Las formas del editor del portal, más *Original* —la imagen entera, que es
 * como arranca— y sin el círculo, que en un informe no tiene lugar.
 */
const FORMAS: { clave: string; etiqueta: string; ratio: number | null | "imagen" }[] = [
  { clave: "original", etiqueta: "Original", ratio: "imagen" },
  { clave: "libre", etiqueta: "Libre", ratio: null },
  { clave: "1:1", etiqueta: "Cuadrada", ratio: 1 },
  { clave: "4:3", etiqueta: "4:3", ratio: 4 / 3 },
  { clave: "3:4", etiqueta: "3:4", ratio: 3 / 4 },
  { clave: "16:9", etiqueta: "16:9", ratio: 16 / 9 },
  { clave: "2:3", etiqueta: "2:3", ratio: 2 / 3 },
];

type Esquina = "nw" | "ne" | "sw" | "se";
const ESQUINAS: Esquina[] = ["nw", "ne", "sw", "se"];
/** Lo más chico que se deja el recuadro, en puntos. */
const MINIMO = 44;
const MARGEN = 16;
const ENTERO: Recuadro = { x: 0, y: 0, w: 1, h: 1 };

/** El mayor recuadro centrado de esa proporción, en fracciones. */
function recuadroParaForma(
  forma: string,
  dims: { w: number; h: number }
): Recuadro {
  const f = FORMAS.find((x) => x.clave === forma);
  if (!f || f.ratio === null || f.ratio === "imagen") return ENTERO;
  const ratio = f.ratio;
  if (dims.w / dims.h > ratio) {
    const w = (ratio * dims.h) / dims.w;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = dims.w / ratio / dims.h;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/** La esquina que se mueve, con la opuesta fija. Corre en el hilo de la UI. */
function moverEsquina(
  esquina: Esquina,
  ax: number,
  ay: number,
  px: number,
  py: number,
  ratio: number | null,
  W: number,
  H: number
): { x: number; y: number; w: number; h: number } {
  "worklet";
  const sx = esquina === "ne" || esquina === "se" ? 1 : -1;
  const sy = esquina === "sw" || esquina === "se" ? 1 : -1;
  const maxW = sx > 0 ? W - ax : ax;
  const maxH = sy > 0 ? H - ay : ay;
  let w = Math.min(Math.max(sx * (px - ax), MINIMO), maxW);
  let h = Math.min(Math.max(sy * (py - ay), MINIMO), maxH);
  if (ratio) {
    h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    if (h < MINIMO) {
      h = MINIMO;
      w = h * ratio;
    }
    if (w > maxW) {
      w = maxW;
      h = w / ratio;
    }
  }
  return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
}

/**
 * Recortar una foto, como en Shopify: *Cancelar* y *Guardar* arriba con
 * deshacer y rehacer en el medio, la foto en el centro con el recuadro que
 * se arrastra por las esquinas o entero, y abajo girar, voltear y la forma.
 *
 * El recuadro vive en **fracciones** de la imagen, como en el editor del
 * portal: la foto se dibuja al tamaño que entre y los píxeles reales se
 * calculan al guardar. Se trabaja sobre la imagen **ya volteada y girada**
 * —que es la que se tiene delante—, en el orden en que sharp lo hace en el
 * servidor: primero el espejo, después el giro, al final el recorte. Aquí no
 * se toca ningún píxel: el servidor aplica la edición con el mismo servicio
 * que el portal y devuelve otra imagen.
 *
 * Cada gesto terminado, cada giro y cada forma es un paso en la historia,
 * que es lo que deshacen y rehacen las flechas.
 */
export function RecortarFoto({
  url,
  guardando = false,
  onCerrar,
  onGuardar,
}: {
  url: string;
  guardando?: boolean;
  onCerrar: () => void;
  onGuardar: (edicion: EdicionDeFoto) => void;
}) {
  const insets = useSafeAreaInsets();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const [historial, setHistorial] = useState<Estado[]>([
    { recuadro: ENTERO, rotar: 0, voltear: false, forma: "original" },
  ]);
  const [indice, setIndice] = useState(0);
  const [eligiendoForma, setEligiendoForma] = useState(false);
  const estado = historial[indice];

  useEffect(() => {
    let vivo = true;
    Image.getSize(
      url,
      (w, h) => {
        if (vivo) setNatural({ w, h });
      },
      () => {
        if (vivo) setNatural({ w: 1, h: 1 });
      }
    );
    return () => {
      vivo = false;
    };
  }, [url]);

  /** La imagen girada: con un cuarto de vuelta, ancho y alto se cambian. */
  const dims = useMemo(() => {
    if (!natural) return null;
    return estado.rotar % 180 === 0
      ? { w: natural.w, h: natural.h }
      : { w: natural.h, h: natural.w };
  }, [natural, estado.rotar]);

  /** Dónde se dibuja la imagen girada dentro del área, en puntos. */
  const caja = useMemo(() => {
    if (!dims || !area) return null;
    const escala = Math.min(
      (area.w - MARGEN * 2) / dims.w,
      (area.h - MARGEN * 2) / dims.h
    );
    const w = dims.w * escala;
    const h = dims.h * escala;
    return { x: (area.w - w) / 2, y: (area.h - h) / 2, w, h };
  }, [dims, area]);

  const ratio = useMemo(() => {
    const f = FORMAS.find((x) => x.clave === estado.forma);
    if (!f) return null;
    if (f.ratio === "imagen") return dims ? dims.w / dims.h : null;
    return f.ratio;
  }, [estado.forma, dims]);

  // El recuadro en puntos, en el hilo de la UI: es lo que el dedo mueve.
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const fw = useSharedValue(0);
  const fh = useSharedValue(0);
  const desde = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!caja) return;
    fx.set(estado.recuadro.x * caja.w);
    fy.set(estado.recuadro.y * caja.h);
    fw.set(estado.recuadro.w * caja.w);
    fh.set(estado.recuadro.h * caja.h);
  }, [caja, estado.recuadro, fx, fy, fw, fh]);

  function empujar(cambio: Partial<Estado>) {
    setHistorial((prev) => [...prev.slice(0, indice + 1), { ...estado, ...cambio }]);
    setIndice(indice + 1);
  }

  /** Lo que quedó al soltar, de vuelta en fracciones. */
  function confirmar(r: { x: number; y: number; w: number; h: number }) {
    if (!caja) return;
    empujar({
      recuadro: {
        x: r.x / caja.w,
        y: r.y / caja.h,
        w: r.w / caja.w,
        h: r.h / caja.h,
      },
    });
  }

  const W = caja?.w ?? 1;
  const H = caja?.h ?? 1;

  const gestosDeEsquina = useMemo(
    () =>
      Object.fromEntries(
        ESQUINAS.map((esquina) => [
          esquina,
          Gesture.Pan()
            .onStart(() => {
              desde.set({ x: fx.get(), y: fy.get(), w: fw.get(), h: fh.get() });
            })
            .onUpdate((e) => {
              const d = desde.get();
              const ax = esquina === "nw" || esquina === "sw" ? d.x + d.w : d.x;
              const ay = esquina === "nw" || esquina === "ne" ? d.y + d.h : d.y;
              const px = (esquina === "nw" || esquina === "sw" ? d.x : d.x + d.w) + e.translationX;
              const py = (esquina === "nw" || esquina === "ne" ? d.y : d.y + d.h) + e.translationY;
              const r = moverEsquina(esquina, ax, ay, px, py, ratio, W, H);
              fx.set(r.x);
              fy.set(r.y);
              fw.set(r.w);
              fh.set(r.h);
            })
            .onEnd(() => {
              scheduleOnRN(confirmar, {
                x: fx.get(),
                y: fy.get(),
                w: fw.get(),
                h: fh.get(),
              });
            }),
        ])
      ) as Record<Esquina, ReturnType<typeof Gesture.Pan>>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ratio, W, H, caja, indice]
  );

  const gestoDeMover = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          desde.set({ x: fx.get(), y: fy.get(), w: fw.get(), h: fh.get() });
        })
        .onUpdate((e) => {
          const d = desde.get();
          fx.set(Math.min(Math.max(d.x + e.translationX, 0), W - d.w));
          fy.set(Math.min(Math.max(d.y + e.translationY, 0), H - d.h));
        })
        .onEnd(() => {
          scheduleOnRN(confirmar, {
            x: fx.get(),
            y: fy.get(),
            w: fw.get(),
            h: fh.get(),
          });
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [W, H, caja, indice]
  );

  const estiloRecuadro = useAnimatedStyle(() => ({
    left: fx.get(),
    top: fy.get(),
    width: fw.get(),
    height: fh.get(),
  }));
  const estiloArriba = useAnimatedStyle(() => ({ left: 0, top: 0, width: W, height: fy.get() }));
  const estiloAbajo = useAnimatedStyle(() => ({
    left: 0,
    top: fy.get() + fh.get(),
    width: W,
    height: Math.max(0, H - fy.get() - fh.get()),
  }));
  const estiloIzquierda = useAnimatedStyle(() => ({
    left: 0,
    top: fy.get(),
    width: fx.get(),
    height: fh.get(),
  }));
  const estiloDerecha = useAnimatedStyle(() => ({
    left: fx.get() + fw.get(),
    top: fy.get(),
    width: Math.max(0, W - fx.get() - fw.get()),
    height: fh.get(),
  }));

  function girar() {
    if (!natural) return;
    const rotar = ((estado.rotar + 90) % 360) as Rotacion;
    const nuevas =
      rotar % 180 === 0 ? { w: natural.w, h: natural.h } : { w: natural.h, h: natural.w };
    empujar({ rotar, recuadro: recuadroParaForma(estado.forma, nuevas) });
  }

  function voltear() {
    // El recuadro se espeja con la foto, así sigue sobre los mismos píxeles.
    const r = estado.recuadro;
    empujar({ voltear: !estado.voltear, recuadro: { ...r, x: 1 - r.x - r.w } });
  }

  function elegirForma(forma: string) {
    setEligiendoForma(false);
    if (!dims || forma === estado.forma) return;
    empujar({ forma, recuadro: recuadroParaForma(forma, dims) });
  }

  function guardar() {
    if (!dims) return;
    const r = estado.recuadro;
    onGuardar({
      recorte: {
        x: Math.round(r.x * dims.w),
        y: Math.round(r.y * dims.h),
        ancho: Math.max(1, Math.round(r.w * dims.w)),
        alto: Math.max(1, Math.round(r.h * dims.h)),
      },
      rotar: estado.rotar,
      voltear: estado.voltear,
    });
  }

  const hayCambios = indice > 0;
  const formaActual = FORMAS.find((f) => f.clave === estado.forma) ?? FORMAS[0];
  // La imagen sin girar, centrada donde va la girada: el giro es un
  // `transform`, y la caja de layout sigue siendo la de antes de girar.
  const sinGirar =
    caja && estado.rotar % 180 !== 0
      ? { w: caja.h, h: caja.w }
      : caja
        ? { w: caja.w, h: caja.h }
        : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View style={[styles.pantalla, { paddingTop: insets.top + 8 }]}>
        <View style={styles.arriba}>
          <Pressable
            onPress={onCerrar}
            disabled={guardando}
            style={({ pressed }) => [styles.pastilla, pressed && styles.tocado]}
          >
            <Text style={styles.pastillaTexto}>Cancelar</Text>
          </Pressable>
          <View style={styles.centro}>
            <Pressable
              onPress={() => setIndice(indice - 1)}
              disabled={indice === 0 || guardando}
              style={({ pressed }) => [
                styles.redondo,
                indice === 0 && styles.apagado,
                pressed && styles.tocado,
              ]}
              accessibilityLabel="Deshacer"
            >
              <Ionicons name="arrow-undo" size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => setIndice(indice + 1)}
              disabled={indice >= historial.length - 1 || guardando}
              style={({ pressed }) => [
                styles.redondo,
                indice >= historial.length - 1 && styles.apagado,
                pressed && styles.tocado,
              ]}
              accessibilityLabel="Rehacer"
            >
              <Ionicons name="arrow-redo" size={20} color="#fff" />
            </Pressable>
          </View>
          <Pressable
            onPress={guardar}
            disabled={!hayCambios || guardando}
            style={({ pressed }) => [styles.pastilla, pressed && styles.tocado]}
          >
            {guardando ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.pastillaTexto, !hayCambios && styles.textoApagado]}>
                Guardar
              </Text>
            )}
          </Pressable>
        </View>

        <View
          style={styles.area}
          onLayout={(e) =>
            setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }
        >
          {!caja || !sinGirar ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <View
                style={{
                  position: "absolute",
                  left: caja.x + caja.w / 2 - sinGirar.w / 2,
                  top: caja.y + caja.h / 2 - sinGirar.h / 2,
                  width: sinGirar.w,
                  height: sinGirar.h,
                  transform: [{ rotate: `${estado.rotar}deg` }],
                }}
              >
                {/* El espejo adentro y el giro afuera: sharp voltea antes
                    de girar, y esto tiene que verse igual. */}
                <Image
                  source={{ uri: url }}
                  style={[
                    styles.imagen,
                    { transform: [{ scaleX: estado.voltear ? -1 : 1 }] },
                  ]}
                  resizeMode="stretch"
                />
              </View>
              <View
                style={{
                  position: "absolute",
                  left: caja.x,
                  top: caja.y,
                  width: caja.w,
                  height: caja.h,
                }}
              >
                <Animated.View style={[styles.velo, estiloArriba]} />
                <Animated.View style={[styles.velo, estiloAbajo]} />
                <Animated.View style={[styles.velo, estiloIzquierda]} />
                <Animated.View style={[styles.velo, estiloDerecha]} />
                <GestureDetector gesture={gestoDeMover}>
                  <Animated.View style={[styles.recuadro, estiloRecuadro]}>
                    <View style={[styles.linea, styles.lineaV, { left: "33.33%" }]} />
                    <View style={[styles.linea, styles.lineaV, { left: "66.66%" }]} />
                    <View style={[styles.linea, styles.lineaH, { top: "33.33%" }]} />
                    <View style={[styles.linea, styles.lineaH, { top: "66.66%" }]} />
                    {ESQUINAS.map((esquina) => (
                      <GestureDetector key={esquina} gesture={gestosDeEsquina[esquina]}>
                        <View style={[styles.asa, styles[esquina]]}>
                          <View style={[styles.gancho, styles[`gancho_${esquina}`]]} />
                        </View>
                      </GestureDetector>
                    ))}
                  </Animated.View>
                </GestureDetector>
              </View>
            </>
          )}
        </View>

        <View style={[styles.abajo, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.centro}>
            <Pressable
              onPress={girar}
              disabled={!natural || guardando}
              style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
              accessibilityLabel="Girar"
            >
              <MaterialCommunityIcons name="rotate-right" size={22} color="#fff" />
            </Pressable>
            <Pressable
              onPress={voltear}
              disabled={!natural || guardando}
              style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
              accessibilityLabel="Voltear"
            >
              <MaterialCommunityIcons name="flip-horizontal" size={22} color="#fff" />
            </Pressable>
          </View>
          <View>
            {eligiendoForma ? (
              <View style={styles.menuFormas}>
                {FORMAS.map((f) => (
                  <Pressable
                    key={f.clave}
                    onPress={() => elegirForma(f.clave)}
                    style={({ pressed }) => [
                      styles.pastilla,
                      styles.pastillaForma,
                      pressed && styles.tocado,
                    ]}
                  >
                    <Ionicons
                      name={f.clave === estado.forma ? "checkmark" : "square-outline"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.pastillaTexto}>{f.etiqueta}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable
              onPress={() => setEligiendoForma((v) => !v)}
              disabled={!natural || guardando}
              style={({ pressed }) => [
                styles.pastilla,
                styles.pastillaForma,
                pressed && styles.tocado,
              ]}
              accessibilityLabel="Forma del recorte"
            >
              <Ionicons name="image-outline" size={18} color="#fff" />
              <Text style={styles.pastillaTexto}>{formaActual.etiqueta}</Text>
              <Ionicons
                name={eligiendoForma ? "chevron-down" : "chevron-up"}
                size={16}
                color="#fff"
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const GANCHO = 22;
const GROSOR = 3;

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#000" },
  arriba: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  abajo: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  centro: { flexDirection: "row", alignItems: "center", gap: 10 },
  pastilla: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#2c2c2e",
    alignItems: "center",
    justifyContent: "center",
  },
  pastillaForma: { flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  pastillaTexto: { color: "#fff", fontSize: 15, fontWeight: "600" },
  textoApagado: { color: "#8e8e93" },
  redondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2c2c2e",
    alignItems: "center",
    justifyContent: "center",
  },
  apagado: { opacity: 0.35 },
  tocado: { opacity: 0.7 },
  area: { flex: 1, alignItems: "center", justifyContent: "center" },
  imagen: { width: "100%", height: "100%" },
  velo: { position: "absolute", backgroundColor: "rgba(0,0,0,0.55)" },
  recuadro: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  linea: { position: "absolute", backgroundColor: "rgba(255,255,255,0.45)" },
  lineaV: { top: 0, bottom: 0, width: 1 },
  lineaH: { left: 0, right: 0, height: 1 },
  asa: {
    position: "absolute",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  nw: { left: -22, top: -22 },
  ne: { right: -22, top: -22 },
  sw: { left: -22, bottom: -22 },
  se: { right: -22, bottom: -22 },
  gancho: {
    position: "absolute",
    width: GANCHO,
    height: GANCHO,
    borderColor: "#fff",
  },
  gancho_nw: { left: 22 - GROSOR, top: 22 - GROSOR, borderTopWidth: GROSOR, borderLeftWidth: GROSOR },
  gancho_ne: { right: 22 - GROSOR, top: 22 - GROSOR, borderTopWidth: GROSOR, borderRightWidth: GROSOR },
  gancho_sw: { left: 22 - GROSOR, bottom: 22 - GROSOR, borderBottomWidth: GROSOR, borderLeftWidth: GROSOR },
  gancho_se: { right: 22 - GROSOR, bottom: 22 - GROSOR, borderBottomWidth: GROSOR, borderRightWidth: GROSOR },
  menuFormas: {
    position: "absolute",
    right: 0,
    bottom: 52,
    gap: 8,
    alignItems: "flex-end",
  },
});
