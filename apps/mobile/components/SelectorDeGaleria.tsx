import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ARRIBA_DE_LA_HOJA } from "@/components/informes/SelectorDeFotos";
import {
  archivoDeAssetDeGaleria,
  duracionCorta,
  type ArchivoDeGaleria,
} from "@/lib/galeria";
import { tema } from "@/lib/tema";

/** Cuántas por fila y qué separa una de otra: la grilla del selector de fotos. */
const COLUMNAS = 4;
const SEPARACION = 6;
const MARGEN = 12;
/** Cuántas trae cada página de la galería. */
const PAGINA = 80;

/**
 * La galería del teléfono, dibujada por nosotros: el selector de WhatsApp.
 *
 * El selector del sistema arranca en blanco cada vez que se abre, y no hay
 * forma de decirle cuáles ya están elegidas: con tres fotos en la bandeja,
 * volver a la galería para agregar una cuarta no mostraba las tres, y elegir
 * una repetida la duplicaba. Acá las que ya están **salen marcadas con su
 * número**, se desmarcan desde la misma grilla, y las nuevas se suman detrás
 * en el orden en que se tocaron —que es el orden en que salen en el mensaje—.
 *
 * Es la forma del selector de fotos de los informes (`SelectorDeFotos`, el
 * *Select files* de Shopify): la ✕ y el título arriba, la grilla de cuatro por
 * fila, la barra oscura que flota con el número y una ⊗ que desmarca todo,
 * *Ver marcadas*, y *Cancelar* / *Listo* en el encabezado en cuanto la
 * selección cambia. Lo que cambia es de dónde salen las fotos: de
 * `expo-media-library`, de a ochenta, las más nuevas primero.
 *
 * Lo que cuesta, y por qué vale: un módulo nativo más (build nuevo de la
 * app) y el permiso de la galería, que el selector del sistema no pedía. Con
 * acceso **limitado** (iOS y Android 14 dejan elegir "solo estas fotos") la
 * grilla muestra esas y ofrece agregar más con el selector del sistema para
 * eso.
 *
 * `onConfirmar` recibe **archivos listos para subir**, en el orden elegido:
 * el `ph://` de la galería no es un archivo, y una foto de iPhone es HEIC
 * (ver `archivoDeAssetDeGaleria`). Convertir diez tarda un instante, y se
 * hace acá con *Preparando…* en el botón, para que las dos pantallas que lo
 * usan no tengan que saber nada de eso.
 */
export function SelectorDeGaleria({
  titulo = "Elegir fotos",
  conVideos = false,
  maximo,
  preseleccion,
  onCerrar,
  onConfirmar,
}: {
  titulo?: string;
  /** El chat manda videos; una novedad, fotos. */
  conVideos?: boolean;
  /** Cuántas pueden quedar marcadas en total. */
  maximo: number;
  /** Los `assetId` de las que ya están, en su orden. */
  preseleccion: string[];
  onCerrar: () => void;
  onConfirmar: (archivos: ArchivoDeGaleria[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permiso, setPermiso] = useState<"pidiendo" | "si" | "limitado" | "no">(
    "pidiendo"
  );
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hayMas, setHayMas] = useState(true);
  const [cargando, setCargando] = useState(false);
  /** En orden: el número que muestra cada foto es su posición acá. */
  const [elegidas, setElegidas] = useState<string[]>(preseleccion);
  const [soloMarcadas, setSoloMarcadas] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const porId = useRef(new Map<string, MediaLibrary.Asset>());

  const cargarPagina = useCallback(
    async (despuesDe: string | undefined) => {
      setCargando(true);
      try {
        const pagina = await MediaLibrary.getAssetsAsync({
          first: PAGINA,
          after: despuesDe,
          mediaType: conVideos
            ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
            : [MediaLibrary.MediaType.photo],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        for (const a of pagina.assets) porId.current.set(a.id, a);
        setAssets((prev) => (despuesDe ? [...prev, ...pagina.assets] : pagina.assets));
        setCursor(pagina.endCursor);
        setHayMas(pagina.hasNextPage);
      } catch {
        setHayMas(false);
      } finally {
        setCargando(false);
      }
    },
    [conVideos]
  );

  /** Pide el permiso y trae la primera página. */
  const arrancar = useCallback(async () => {
    const r = await MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]);
    if (!r.granted) {
      setPermiso("no");
      return;
    }
    setPermiso(r.accessPrivileges === "limited" ? "limitado" : "si");
    porId.current.clear();
    await cargarPagina(undefined);
  }, [cargarPagina]);

  useEffect(() => {
    void arrancar();
  }, [arrancar]);

  const lado = Math.floor((width - MARGEN * 2 - SEPARACION * (COLUMNAS - 1)) / COLUMNAS);
  const total = elegidas.length;
  const hayCambios =
    elegidas.length !== preseleccion.length ||
    elegidas.some((id, i) => preseleccion[i] !== id);
  const visibles = soloMarcadas ? assets.filter((a) => elegidas.includes(a.id)) : assets;

  function alternar(id: string) {
    setAviso(null);
    setElegidas((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maximo) {
        setAviso(`Hasta ${maximo} ${maximo === 1 ? "archivo" : "archivos"} por vez.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  /**
   * Las elegidas, en su orden, convertidas en archivos. Una que venía
   * preseleccionada puede no estar en las páginas cargadas —es de hace un
   * año—; se pide por id.
   */
  async function confirmar() {
    setPreparando(true);
    setAviso(null);
    try {
      const archivos: ArchivoDeGaleria[] = [];
      for (const id of elegidas) {
        const asset =
          porId.current.get(id) ?? (await MediaLibrary.getAssetInfoAsync(id));
        archivos.push(await archivoDeAssetDeGaleria(asset));
      }
      onConfirmar(archivos);
    } catch {
      setAviso("No pudimos preparar una de las fotos. Prueba otra vez.");
      setPreparando(false);
    }
  }

  /** Con acceso limitado, el sistema deja ampliar qué fotos ve la app. */
  async function elegirMasFotos() {
    await MediaLibrary.presentPermissionsPickerAsync();
    porId.current.clear();
    await cargarPagina(undefined);
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onCerrar}
      presentationStyle="pageSheet"
    >
      <View style={[styles.pantalla, { paddingTop: ARRIBA_DE_LA_HOJA(insets.top) }]}>
        <View style={styles.encabezado}>
          {hayCambios ? (
            <Pressable
              onPress={onCerrar}
              disabled={preparando}
              style={({ pressed }) => [styles.pastilla, pressed && styles.tocado]}
              accessibilityRole="button"
            >
              <Text style={styles.pastillaTexto}>Cancelar</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onCerrar}
              style={({ pressed }) => [styles.redondo, pressed && styles.tocado]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={22} color={tema.texto} />
            </Pressable>
          )}
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo}
          </Text>
          {hayCambios ? (
            <Pressable
              onPress={confirmar}
              disabled={preparando}
              style={({ pressed }) => [
                styles.pastilla,
                styles.pastillaListo,
                pressed && styles.tocado,
              ]}
              accessibilityRole="button"
            >
              {preparando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.pastillaTexto, styles.pastillaListoTexto]}>Listo</Text>
              )}
            </Pressable>
          ) : (
            // El mismo ancho que la ✕, para que el título quede centrado.
            <View style={styles.redondoVacio} />
          )}
        </View>

        {permiso === "limitado" ? (
          <Pressable onPress={elegirMasFotos} style={styles.limitado}>
            <Text style={styles.limitadoTexto}>
              Solo ves algunas fotos.{" "}
              <Text style={styles.limitadoEnlace}>Elegir más</Text>
            </Text>
          </Pressable>
        ) : null}
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

        {permiso === "pidiendo" ? (
          <View style={styles.centro}>
            <ActivityIndicator color={tema.verde} />
          </View>
        ) : permiso === "no" ? (
          <View style={styles.centro}>
            <Ionicons name="images-outline" size={40} color={tema.texto3} />
            <Text style={styles.sinPermisoTitulo}>Sin acceso a tus fotos</Text>
            <Text style={styles.sinPermisoTexto}>
              Para elegir fotos de la galería, dale permiso a la app en los
              ajustes del teléfono.
            </Text>
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [styles.pastilla, styles.pastillaListo, pressed && styles.tocado]}
              accessibilityRole="button"
            >
              <Text style={[styles.pastillaTexto, styles.pastillaListoTexto]}>Abrir ajustes</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={visibles}
            keyExtractor={(a) => a.id}
            numColumns={COLUMNAS}
            contentContainerStyle={styles.grilla}
            columnWrapperStyle={styles.filaGrilla}
            onEndReached={() => {
              if (!soloMarcadas && hayMas && !cargando) void cargarPagina(cursor);
            }}
            onEndReachedThreshold={1.5}
            initialNumToRender={24}
            windowSize={7}
            removeClippedSubviews
            ListEmptyComponent={
              cargando ? null : (
                <Text style={styles.vacio}>
                  {soloMarcadas ? "Nada marcado." : "No hay fotos en el teléfono."}
                </Text>
              )
            }
            ListFooterComponent={
              cargando && assets.length > 0 ? (
                <ActivityIndicator style={styles.pie} color={tema.verde} />
              ) : null
            }
            renderItem={({ item: a }) => {
              const posicion = elegidas.indexOf(a.id);
              const marcada = posicion >= 0;
              return (
                <Pressable
                  onPress={() => alternar(a.id)}
                  style={[styles.celda, { width: lado, height: lado }, marcada && styles.celdaMarcada]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcada }}
                  accessibilityLabel={a.filename}
                >
                  <Image
                    source={{ uri: a.uri }}
                    style={styles.imagen}
                    contentFit="cover"
                    recyclingKey={a.id}
                    transition={0}
                  />
                  {a.mediaType === "video" ? (
                    <View style={styles.video}>
                      <Ionicons name="videocam" size={12} color="#fff" />
                      <Text style={styles.videoTexto}>{duracionCorta(a.duration)}</Text>
                    </View>
                  ) : null}
                  {/* El número y no una tilde: el orden en que se tocaron es
                      el orden en que salen, y con seis fotos hay que poder
                      verlo antes de mandar. */}
                  <View style={[styles.casilla, marcada && styles.casillaMarcada]}>
                    {marcada ? <Text style={styles.numero}>{posicion + 1}</Text> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {total > 0 && permiso !== "no" ? (
          <View
            style={[styles.barraFlotante, { bottom: Math.max(insets.bottom, 12) }]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={() => {
                setElegidas([]);
                setSoloMarcadas(false);
              }}
              style={({ pressed }) => [styles.barraBoton, pressed && styles.tocado]}
              accessibilityRole="button"
              accessibilityLabel="Desmarcar todas"
            >
              <Ionicons name="close-circle-outline" size={22} color="#fff" />
              <Text style={styles.barraNumero}>{total}</Text>
            </Pressable>
            <Pressable
              onPress={() => setSoloMarcadas((v) => !v)}
              style={({ pressed }) => [styles.barraBoton, pressed && styles.tocado]}
              accessibilityRole="button"
              accessibilityState={{ selected: soloMarcadas }}
            >
              <Text style={styles.barraTexto}>
                {soloMarcadas ? "Ver todas" : "Ver marcadas"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.superficie },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: MARGEN,
    paddingBottom: 8,
  },
  titulo: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
  },
  redondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
  },
  redondoVacio: { width: 40, height: 40 },
  tocado: { opacity: 0.6 },
  pastilla: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  pastillaTexto: { fontSize: 15, fontWeight: "600", color: tema.texto },
  pastillaListo: { backgroundColor: tema.verde, minWidth: 72 },
  pastillaListoTexto: { color: "#fff" },
  limitado: { paddingHorizontal: MARGEN, paddingBottom: 8 },
  limitadoTexto: { fontSize: 13, color: tema.texto3 },
  limitadoEnlace: { color: tema.verde700, fontWeight: "700" },
  aviso: { color: "#c62828", fontSize: 12, paddingHorizontal: MARGEN, paddingBottom: 6 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  sinPermisoTitulo: { fontSize: 17, fontWeight: "700", color: tema.texto },
  sinPermisoTexto: {
    fontSize: 14,
    color: tema.texto3,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 6,
  },
  grilla: { paddingHorizontal: MARGEN, paddingBottom: 96, gap: SEPARACION },
  filaGrilla: { gap: SEPARACION },
  vacio: { padding: 24, color: tema.texto3, textAlign: "center" },
  pie: { paddingVertical: 16 },
  celda: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: tema.lienzo,
    borderWidth: 2,
    borderColor: "transparent",
  },
  celdaMarcada: { borderColor: tema.verde },
  imagen: { width: "100%", height: "100%" },
  video: {
    position: "absolute",
    left: 5,
    bottom: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  videoTexto: { color: "#fff", fontSize: 11, fontWeight: "600" },
  casilla: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { backgroundColor: tema.verde, borderColor: tema.verde },
  numero: { color: "#fff", fontSize: 12, fontWeight: "800" },
  // La barra de Shopify: oscura, flotando sobre la grilla.
  barraFlotante: {
    position: "absolute",
    left: MARGEN,
    right: MARGEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    borderRadius: 14,
    backgroundColor: "#1c1f1d",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  barraBoton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  barraNumero: { color: "#fff", fontSize: 16, fontWeight: "700" },
  barraTexto: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
