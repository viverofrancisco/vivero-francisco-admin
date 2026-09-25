import { useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Switch, Text } from "react-native-paper";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  aHtml,
  partirPrimerBloque,
  simplificarHtml,
  simplificarTitulo,
  textoPlanoDeHtml,
  tituloDeSeccionEnHtml,
} from "@vivero/shared";
import {
  EditorDeTextoRico,
  type EditorDeTextoRicoHandle,
} from "@/components/informes/EditorDeTextoRico";
import type { SeccionFotoDraft } from "@/components/informes/SelectorDeFotos";
import { tema } from "@/lib/tema";

export type FotosPorFila = 2 | 3 | 4 | 5 | 6;
export type AlineacionDeFotos = "IZQUIERDA" | "CENTRO" | "DERECHA";

/** Lo que la ficha edita de una sección: su texto, sus fotos y cómo se imprimen. */
export interface SeccionEditable {
  tempId: string;
  titulo: string;
  descripcion: string;
  fotos: SeccionFotoDraft[];
  saltoDePagina: boolean;
  fotosPorFila: FotosPorFila;
  fotosAlineacion: AlineacionDeFotos;
}

const FOTOS_POR_FILA: FotosPorFila[] = [2, 3, 4, 5, 6];
const ALINEACIONES: { valor: AlineacionDeFotos; icono: "format-align-left" | "format-align-center" | "format-align-right"; nombre: string }[] = [
  { valor: "IZQUIERDA", icono: "format-align-left", nombre: "Fotos a la izquierda" },
  { valor: "CENTRO", icono: "format-align-center", nombre: "Fotos centradas" },
  { valor: "DERECHA", icono: "format-align-right", nombre: "Fotos a la derecha" },
];

type Pestana = "texto" | "fotos";

/**
 * Una sección abierta, como el panel del portal en el teléfono: la cabecera
 * dice cuál es —*Sección N de M*, con las flechas a la anterior y la
 * siguiente, el tacho y *Listo*— y debajo dos pestañas, **Texto** y
 * **Fotos**. El texto es el editor de texto rico con toda la pantalla para
 * él; las fotos son cómo se imprimen —cuántas por fila, hacia dónde, si
 * arranca en hoja nueva— y la grilla, con *Agregar fotos* debajo.
 *
 * Las fotos y el layout se aplican al tocar; el texto se lee del editor al
 * salir de la pestaña, al cambiar de sección y al dar *Listo* —y se parte
 * en las dos columnas de siempre—, porque el WebView no avisa por tecla. La
 * ✕ deja el texto como estaba: es la salida sin guardar lo escrito.
 */
export function FichaDeSeccion({
  seccion,
  indice,
  total,
  pestanaInicial = "texto",
  onCambiar,
  onEliminar,
  onIr,
  onCerrar,
  onAgregarFotos,
  onRecortar,
}: {
  seccion: SeccionEditable;
  indice: number;
  total: number;
  pestanaInicial?: Pestana;
  onCambiar: (patch: Partial<SeccionEditable>) => void;
  onEliminar: () => void;
  /** A la sección anterior (-1) o la siguiente (+1). */
  onIr: (paso: -1 | 1) => void;
  onCerrar: () => void;
  onAgregarFotos: () => void;
  onRecortar: (foto: SeccionFotoDraft) => void;
}) {
  const insets = useSafeAreaInsets();
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const editor = useRef<EditorDeTextoRicoHandle>(null);

  /** Lo escrito, a la sección. Falso si no hay título, que es lo único que se exige. */
  async function guardarTexto(): Promise<boolean> {
    if (!editor.current) return true;
    const html = await editor.current.obtener();
    const { primero, resto } = partirPrimerBloque(html);
    const titulo = simplificarTitulo(primero);
    if (!textoPlanoDeHtml(titulo)) {
      setAviso("Escribe el título en la primera línea.");
      return false;
    }
    setAviso(null);
    onCambiar({ titulo, descripcion: simplificarHtml(resto) });
    return true;
  }
  async function cambiarPestana(p: Pestana) {
    if (p === pestana) return;
    if (pestana === "texto" && !(await guardarTexto())) return;
    setPestana(p);
  }
  async function listo() {
    if (pestana === "texto" && !(await guardarTexto())) return;
    onCerrar();
  }
  async function ir(paso: -1 | 1) {
    if (pestana === "texto" && !(await guardarTexto())) return;
    onIr(paso);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <View style={[styles.pantalla, { paddingTop: insets.top + 8 }]}>
        <View style={styles.cabecera}>
          <Pressable
            onPress={onCerrar}
            style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sin guardar el texto"
          >
            <Ionicons name="close" size={20} color={tema.texto} />
          </Pressable>
          <Pressable
            onPress={() => void ir(-1)}
            disabled={indice === 0}
            style={({ pressed }) => [styles.flecha, indice === 0 && styles.apagado, pressed && styles.tocado]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Sección anterior"
          >
            <Ionicons name="chevron-back" size={22} color={tema.texto} />
          </Pressable>
          <Text style={styles.titulo} numberOfLines={1}>
            Sección {indice + 1} de {total}
          </Text>
          <Pressable
            onPress={() => void ir(1)}
            disabled={indice >= total - 1}
            style={({ pressed }) => [styles.flecha, indice >= total - 1 && styles.apagado, pressed && styles.tocado]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Sección siguiente"
          >
            <Ionicons name="chevron-forward" size={22} color={tema.texto} />
          </Pressable>
          <Pressable
            onPress={onEliminar}
            style={({ pressed }) => [styles.flecha, pressed && styles.tocado]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Eliminar la sección"
          >
            <Ionicons name="trash-outline" size={21} color="#c62828" />
          </Pressable>
          <Pressable
            onPress={() => void listo()}
            style={({ pressed }) => [styles.listo, pressed && styles.tocado]}
            accessibilityRole="button"
            accessibilityLabel="Listo"
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.pestanas}>
          {(["texto", "fotos"] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => void cambiarPestana(p)}
              style={[styles.pestana, pestana === p && styles.pestanaActiva]}
              accessibilityRole="tab"
              accessibilityState={{ selected: pestana === p }}
            >
              <Text style={[styles.pestanaTexto, pestana === p && styles.pestanaTextoActivo]}>
                {p === "texto" ? "Texto" : `Fotos${seccion.fotos.length ? ` (${seccion.fotos.length})` : ""}`}
              </Text>
            </Pressable>
          ))}
        </View>
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

        {pestana === "texto" ? (
          <EditorDeTextoRico
            key={seccion.tempId}
            ref={editor}
            html={tituloDeSeccionEnHtml(seccion.titulo) + aHtml(seccion.descripcion)}
            placeholder="El título en la primera línea; debajo, la descripción"
            primeraLineaComoTitulo
          />
        ) : (
          <ScrollView
            style={styles.fotos}
            contentContainerStyle={[styles.fotosCuerpo, { paddingBottom: insets.bottom + 24 }]}
          >
            {/* Cómo se imprimen: cuántas por fila, hacia dónde se arriman
                las de la última fila cuando no se llena, y si arranca en
                hoja nueva. Lo mismo que el portal, en filas. */}
            <View style={styles.filaDeLayout}>
              <Text style={styles.rotulo}>Fotos por fila</Text>
              <View style={styles.pastillas}>
                {FOTOS_POR_FILA.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => onCambiar({ fotosPorFila: n })}
                    style={[styles.pastilla, seccion.fotosPorFila === n && styles.pastillaActiva]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: seccion.fotosPorFila === n }}
                  >
                    <Text
                      style={[
                        styles.pastillaTexto,
                        seccion.fotosPorFila === n && styles.pastillaTextoActivo,
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.filaDeLayout}>
              <Text style={styles.rotulo}>Alinear</Text>
              <View style={styles.pastillas}>
                {ALINEACIONES.map((a) => (
                  <Pressable
                    key={a.valor}
                    onPress={() => onCambiar({ fotosAlineacion: a.valor })}
                    style={[styles.pastilla, seccion.fotosAlineacion === a.valor && styles.pastillaActiva]}
                    accessibilityRole="button"
                    accessibilityLabel={a.nombre}
                    accessibilityState={{ selected: seccion.fotosAlineacion === a.valor }}
                  >
                    <MaterialCommunityIcons
                      name={a.icono}
                      size={20}
                      color={seccion.fotosAlineacion === a.valor ? "#fff" : tema.texto}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.filaDeLayout}>
              <Text style={styles.rotulo}>Empezar en hoja nueva</Text>
              <Switch
                value={seccion.saltoDePagina}
                onValueChange={(v) => onCambiar({ saltoDePagina: v })}
                color={tema.verde}
              />
            </View>

            {seccion.fotos.length > 0 ? (
              <View style={styles.grilla}>
                {seccion.fotos.map((f) => (
                  <View key={f.uid} style={styles.celda}>
                    {/* Tocar la foto la abre para recortarla, como en el portal. */}
                    <Pressable
                      onPress={() => onRecortar(f)}
                      style={styles.foto}
                      accessibilityRole="button"
                      accessibilityLabel="Recortar la foto"
                    >
                      <Image source={{ uri: f.url }} style={styles.foto} />
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        onCambiar({ fotos: seccion.fotos.filter((x) => x.uid !== f.uid) })
                      }
                      style={styles.quitar}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Quitar de esta sección"
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.vacio}>
                <Text style={styles.vacioTexto}>
                  Agrégalas de las visitas, la biblioteca, la galería o la cámara.
                </Text>
              </View>
            )}
            <Pressable
              onPress={onAgregarFotos}
              style={({ pressed }) => [styles.agregar, pressed && styles.tocado]}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.agregarTexto}>Agregar fotos</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  redondo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
    marginRight: 4,
  },
  flecha: {
    width: 36,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  apagado: { opacity: 0.3 },
  tocado: { opacity: 0.6 },
  titulo: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: tema.texto,
  },
  // Del tamaño de la ✕ del otro lado: es su par.
  listo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  pestanas: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  pestana: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  pestanaActiva: { borderBottomColor: tema.verde },
  pestanaTexto: { fontSize: 15, fontWeight: "600", color: tema.texto2 },
  pestanaTextoActivo: { color: tema.verde700 },
  aviso: { color: "#c62828", fontSize: 12, paddingHorizontal: 16, paddingTop: 8 },
  fotos: { flex: 1 },
  fotosCuerpo: { padding: 16, gap: 14 },
  filaDeLayout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rotulo: { fontSize: 15, color: tema.texto, fontWeight: "500" },
  pastillas: { flexDirection: "row", gap: 6 },
  pastilla: {
    minWidth: 40,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
  },
  pastillaActiva: { backgroundColor: tema.verde },
  pastillaTexto: { fontSize: 14, fontWeight: "600", color: tema.texto },
  pastillaTextoActivo: { color: "#fff" },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  celda: {
    width: "32%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: tema.lienzo,
  },
  foto: { width: "100%", height: "100%" },
  quitar: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  vacio: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: tema.linea,
    padding: 24,
    marginTop: 4,
  },
  vacioTexto: { color: tema.texto3, textAlign: "center", fontSize: 14 },
  agregar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 10,
    backgroundColor: tema.verde,
  },
  agregarTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
