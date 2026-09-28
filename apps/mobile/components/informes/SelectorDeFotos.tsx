import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { ActivityIndicator, Searchbar, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fechaSola } from "@vivero/shared";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

/** Una foto de las visitas elegidas, de donde salen casi todas. */
export interface MediaPoolItem {
  id: string;
  url: string;
  visitaId: string;
  visitaFecha: string;
  /** La tarea con la que se etiquetó la foto, si la tiene. */
  tareaId: string | null;
}

/**
 * Foto de una sección: o viene de una visita (`visitaMediaId`) o de la
 * biblioteca (`mediaId`), por donde entra lo que se sube. `url` siempre
 * sirve para previsualizar.
 */
export interface SeccionFotoDraft {
  uid: string;
  visitaMediaId: string | null;
  mediaId: string | null;
  url: string;
}

export function fotoDeVisita(m: MediaPoolItem): SeccionFotoDraft {
  return { uid: `visita-${m.id}`, visitaMediaId: m.id, mediaId: null, url: m.url };
}

export function fotoDeBiblioteca(m: { id: string; url: string }): SeccionFotoDraft {
  return { uid: `media-${m.id}`, visitaMediaId: null, mediaId: m.id, url: m.url };
}

export interface MediaItem {
  id: string;
  url: string;
  nombre: string;
}

/** Un archivo en el teléfono, listo para subir. */
export interface ArchivoLocal {
  uri: string;
  fileName: string;
  contentType: string;
}

/** Lo que devuelve el selector del sistema, con nombre y tipo resueltos. */
export function archivoDeAsset(a: ImagePicker.ImagePickerAsset): ArchivoLocal {
  const fileName =
    a.fileName ?? a.uri.split("/").pop() ?? `imagen-${Date.now()}.jpg`;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { uri: a.uri, fileName, contentType };
}

/**
 * A la biblioteca, en los dos pasos del portal: URLs firmadas, el archivo
 * directo a R2, y la confirmación de lo que llegó. Devuelve lo guardado, en
 * el orden en que subió; lo que no llegó simplemente no está.
 */
export async function subirImagenesALaBiblioteca(
  archivos: ArchivoLocal[]
): Promise<MediaItem[]> {
  const { uploads } = await apiRequest<{
    uploads: { key: string; uploadUrl: string; url: string }[];
  }>("/api/mobile/media", {
    method: "POST",
    body: {
      files: archivos.map((a) => ({
        fileName: a.fileName,
        contentType: a.contentType,
      })),
    },
  });
  const llegados: { key: string; nombre: string; contentType: string }[] = [];
  await Promise.all(
    uploads.map(async (u, i) => {
      const archivo = archivos[i];
      const blob = await (await fetch(archivo.uri)).blob();
      const put = await fetch(u.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": archivo.contentType },
        body: blob,
      });
      if (put.ok) {
        llegados.push({
          key: u.key,
          nombre: archivo.fileName,
          contentType: archivo.contentType,
        });
      }
    })
  );
  if (llegados.length === 0) throw new Error("No pudimos subir las fotos.");
  const { media } = await apiRequest<{ media: MediaItem[] }>(
    "/api/mobile/media",
    { method: "PUT", body: { archivos: llegados } }
  );
  return media;
}

type Origen = "todas" | "visitas" | "biblioteca";

const ORIGENES: { clave: Origen; etiqueta: string }[] = [
  { clave: "todas", etiqueta: "Todas" },
  { clave: "visitas", etiqueta: "De las visitas" },
  { clave: "biblioteca", etiqueta: "Biblioteca" },
];

interface FotoElegible {
  clave: string;
  url: string;
  nombre: string;
  origen: "visita" | "biblioteca";
  draft: SeccionFotoDraft;
}

/** Lo que va arriba del contenido de una hoja `pageSheet`. */
export const ARRIBA_DE_LA_HOJA = (insetTop: number) =>
  Platform.OS === "ios" ? 12 : insetTop + 8;

/** Cuántas por fila y qué separa una de otra. */
const COLUMNAS = 4;
const SEPARACION = 6;
const MARGEN = 12;

/**
 * Elegir las fotos de una sección, como el *Select files* de Shopify en el
 * teléfono: la ✕, el título y dos botones redondos —la cámara, para la foto
 * que se saca en el momento, y el + que abre la hoja *Agregar fotos* con la
 * galería y la cámara—; el buscador con el filtro de origen al lado (una hoja:
 * todas, las de las visitas, la biblioteca); la grilla de cuatro por fila con
 * una casilla en cada foto. Nada al pie: en cuanto hay algo marcado flota la
 * **barra oscura** de Shopify, con el número y una ⊗ que desmarca todo, y
 * *Ver marcadas*, que deja la grilla solo con ellas; y en cuanto la selección
 * **cambia** respecto de la que entró, arriba aparecen *Cancelar* y *Listo*
 * en lugar de la ✕ y la cámara.
 *
 * Las que la sección ya tiene salen marcadas, y desmarcar una la quita: es la
 * misma pregunta —cuáles van— contestada en un solo lugar. Por eso
 * `onConfirmar` recibe la lista **final**: las que quedan, en el orden que
 * tenían, y detrás las nuevas.
 *
 * Lo que se sube entra a la **biblioteca** (`/api/mobile/media`), igual que
 * en el portal, y queda marcado de una, porque por algo se subió. Antes se
 * subía colgado del informe y no se podía volver a usar ni recortar.
 *
 * Es la misma pantalla que el portal muestra debajo de `md`.
 */
export function SelectorDeFotos({
  pool,
  enLaSeccion,
  soloBiblioteca = false,
  unaSola = false,
  onCerrar,
  onConfirmar,
}: {
  /** Las de las visitas que se ofrecen: las libres y las de esta sección. */
  pool: MediaPoolItem[];
  /** Las fotos que la sección ya tiene, en su orden. */
  enLaSeccion: SeccionFotoDraft[];
  /**
   * Solo la biblioteca, sin el filtro de origen: es lo que usa la ficha del
   * producto, que no tiene visitas de dónde sacar fotos.
   */
  soloBiblioteca?: boolean;
  /**
   * Una sola, para donde no hay galería sino una foto: la de una variante.
   * Marcar otra desmarca la anterior; tocar la marcada la desmarca.
   */
  unaSola?: boolean;
  onCerrar: () => void;
  onConfirmar: (fotos: SeccionFotoDraft[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [busqueda, setBusqueda] = useState("");
  const [origen, setOrigen] = useState<Origen>(soloBiblioteca ? "biblioteca" : "todas");
  const [biblioteca, setBiblioteca] = useState<MediaItem[] | null>(null);
  const [elegidas, setElegidas] = useState<Set<string>>(
    () => new Set(enLaSeccion.map((f) => f.uid))
  );
  const [hoja, setHoja] = useState<"origen" | "agregar" | null>(null);
  /** La grilla solo con lo marcado: *Ver marcadas* de la barra. */
  const [soloMarcadas, setSoloMarcadas] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // La biblioteca, buscada por nombre en el servidor, ~300 ms después de
  // dejar de escribir; de entrada, sin esperar.
  useEffect(() => {
    let cancelado = false;
    const q = busqueda.trim();
    const reloj = setTimeout(
      () => {
        apiRequest<{ media: MediaItem[] }>("/api/mobile/media", {
          query: q ? { q } : {},
        })
          .then((r) => {
            if (!cancelado) setBiblioteca(r.media ?? []);
          })
          .catch(() => {
            if (!cancelado) setBiblioteca([]);
          });
      },
      q ? 300 : 0
    );
    return () => {
      cancelado = true;
      clearTimeout(reloj);
    };
  }, [busqueda]);

  const q = busqueda.trim().toLowerCase();
  const deVisitas: FotoElegible[] = pool.map((m) => ({
    clave: `visita-${m.id}`,
    url: m.url,
    nombre: `Visita del ${fechaSola(m.visitaFecha, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`,
    origen: "visita",
    draft: fotoDeVisita(m),
  }));
  const deBiblioteca: FotoElegible[] = (biblioteca ?? []).map((m) => ({
    clave: `media-${m.id}`,
    url: m.url,
    nombre: m.nombre,
    origen: "biblioteca",
    draft: fotoDeBiblioteca(m),
  }));
  const todas = [...deVisitas, ...deBiblioteca];
  // La biblioteca ya viene buscada del servidor; las de las visitas se
  // filtran acá por su fecha, que es lo que se sabe de ellas.
  const visibles = todas.filter(
    (f) =>
      (origen === "todas" ||
        f.origen === (origen === "visitas" ? "visita" : "biblioteca")) &&
      (!q || f.origen === "biblioteca" || f.nombre.toLowerCase().includes(q)) &&
      (!soloMarcadas || elegidas.has(f.clave))
  );
  const total = elegidas.size;
  // Si la selección es otra que la que entró: es lo que enciende Listo.
  const hayCambios =
    elegidas.size !== enLaSeccion.length ||
    enLaSeccion.some((f) => !elegidas.has(f.uid));
  const lado = Math.floor(
    (width - MARGEN * 2 - SEPARACION * (COLUMNAS - 1)) / COLUMNAS
  );

  const alternar = (clave: string) =>
    setElegidas((prev) => {
      if (unaSola) return prev.has(clave) ? new Set() : new Set([clave]);
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });

  /**
   * La lista final: las de la sección que siguen marcadas, en su orden, y
   * detrás las nuevas en el orden de la grilla. Las de la sección se toman
   * de `enLaSeccion` y no de la grilla, porque la biblioteca llega acotada y
   * buscada: una foto que la búsqueda dejó fuera sigue en la sección.
   */
  function confirmar() {
    const quedan = enLaSeccion.filter((f) => elegidas.has(f.uid));
    const yaEstaban = new Set(enLaSeccion.map((f) => f.uid));
    const nuevas = todas
      .filter((f) => elegidas.has(f.clave) && !yaEstaban.has(f.clave))
      .map((f) => f.draft);
    onConfirmar([...quedan, ...nuevas]);
  }

  /** Sube lo elegido y lo deja marcado: por algo se subió. */
  async function subirALaBiblioteca(assets: ImagePicker.ImagePickerAsset[]) {
    setAviso(null);
    setSubiendo(true);
    try {
      const archivos = assets.map(archivoDeAsset);
      const media = await subirImagenesALaBiblioteca(archivos);
      setBiblioteca((prev) => [...media, ...(prev ?? [])]);
      setElegidas((prev) => {
        if (unaSola) return new Set(media.slice(-1).map((m) => `media-${m.id}`));
        const next = new Set(prev);
        for (const m of media) next.add(`media-${m.id}`);
        return next;
      });
      if (media.length < archivos.length) {
        setAviso(`${media.length} de ${archivos.length}: alguna no subió.`);
      }
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos subir las fotos"));
    } finally {
      setSubiendo(false);
    }
  }

  async function sacarFoto() {
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!r.canceled && r.assets.length > 0) void subirALaBiblioteca(r.assets);
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      // Lo que la biblioteca acepta por pedido.
      selectionLimit: 10,
    });
    if (!r.canceled && r.assets.length > 0) void subirALaBiblioteca(r.assets);
  }

  /**
   * Los selectores del sistema esperan un instante: se presentan sobre la
   * pantalla, y si la hoja todavía se está yendo iOS los rechaza sin decir
   * nada.
   */
  function despuesDeCerrarLaHoja(abrir: () => void) {
    setHoja(null);
    setTimeout(abrir, 150);
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onCerrar}
      presentationStyle="pageSheet"
    >
      {/* Una hoja (`pageSheet`) ya arranca debajo de la barra de estado en
          iOS: sumarle el inset del notch dejaba un dedo de blanco arriba. En
          Android el modal es la pantalla entera y ahí sí hace falta. */}
      <View style={[styles.pantalla, { paddingTop: ARRIBA_DE_LA_HOJA(insets.top) }]}>
        <View style={styles.encabezado}>
          {hayCambios ? (
            <Pressable
              onPress={onCerrar}
              disabled={subiendo}
              style={({ pressed }) => [styles.pastilla, pressed && styles.redondoTocado]}
              accessibilityRole="button"
            >
              <Text style={styles.pastillaTexto}>Cancelar</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onCerrar}
              style={({ pressed }) => [styles.redondo, pressed && styles.redondoTocado]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close-outline" size={18} color={tema.texto} />
            </Pressable>
          )}
          <Text style={styles.titulo} numberOfLines={1}>
            Elegir fotos
          </Text>
          {!hayCambios ? (
            <Pressable
              onPress={sacarFoto}
              disabled={subiendo}
              style={({ pressed }) => [styles.redondo, pressed && styles.redondoTocado]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Tomar una foto"
            >
              <Ionicons name="camera-outline" size={18} color={tema.texto} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setHoja("agregar")}
            disabled={subiendo}
            style={({ pressed }) => [styles.redondo, pressed && styles.redondoTocado]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Agregar fotos"
          >
            <Ionicons name="add-circle-outline" size={20} color={tema.texto} />
          </Pressable>
          {hayCambios ? (
            <Pressable
              onPress={confirmar}
              disabled={subiendo}
              style={({ pressed }) => [
                styles.pastilla,
                styles.pastillaListo,
                pressed && styles.redondoTocado,
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.pastillaTexto, styles.pastillaListoTexto]}>Listo</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filaBuscar}>
          <Searchbar
            placeholder="Buscar fotos"
            value={busqueda}
            onChangeText={setBusqueda}
            elevation={0}
            style={styles.buscador}
            inputStyle={styles.buscadorTexto}
          />
          {soloBiblioteca ? null : (
            <Pressable
              onPress={() => setHoja("origen")}
              style={({ pressed }) => [
                styles.redondo,
                origen !== "todas" && styles.redondoActivo,
                pressed && styles.redondoTocado,
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Mostrar de dónde"
            >
              <Ionicons
                name="filter-outline"
                size={18}
                color={origen !== "todas" ? tema.verde : tema.texto}
              />
            </Pressable>
          )}
        </View>
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
        {subiendo ? (
          <View style={styles.subiendo}>
            <ActivityIndicator size="small" color={tema.verde} />
            <Text style={styles.subiendoTexto}>Subiendo…</Text>
          </View>
        ) : null}

        {biblioteca === null && pool.length === 0 ? (
          <View style={styles.cargando}>
            <ActivityIndicator color={tema.verde} />
          </View>
        ) : (
          <FlatList
            data={visibles}
            keyExtractor={(f) => f.clave}
            numColumns={COLUMNAS}
            contentContainerStyle={styles.grilla}
            columnWrapperStyle={styles.filaGrilla}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <Text style={styles.vacio}>
                {soloMarcadas
                  ? "Ninguna foto marcada."
                  : q
                    ? "Ninguna foto coincide con la búsqueda."
                    : "No hay fotos para elegir. Sube las tuyas."}
              </Text>
            }
            renderItem={({ item: f }) => {
              const marcada = elegidas.has(f.clave);
              return (
                <Pressable
                  onPress={() => alternar(f.clave)}
                  style={[
                    styles.celda,
                    { width: lado, height: lado },
                    marcada && styles.celdaMarcada,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcada }}
                  accessibilityLabel={f.nombre}
                >
                  <Image source={{ uri: f.url }} style={styles.imagen} />
                  <View style={[styles.casilla, marcada && styles.casillaMarcada]}>
                    {marcada ? (
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {total > 0 ? (
          <View
            style={[styles.barraFlotante, { bottom: Math.max(insets.bottom, 12) }]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={() => {
                setElegidas(new Set());
                setSoloMarcadas(false);
              }}
              style={({ pressed }) => [styles.barraBoton, pressed && styles.redondoTocado]}
              accessibilityRole="button"
              accessibilityLabel="Desmarcar todas"
            >
              <Ionicons name="close-circle-outline" size={22} color="#fff" />
              <Text style={styles.barraNumero}>{total}</Text>
            </Pressable>
            <Pressable
              onPress={() => setSoloMarcadas((v) => !v)}
              style={({ pressed }) => [styles.barraBoton, pressed && styles.redondoTocado]}
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

      <HojaInferior visible={hoja === "origen"} onCerrar={() => setHoja(null)}>
        <Text style={styles.hojaTitulo}>Mostrar</Text>
        {ORIGENES.map((o) => (
          <Pressable
            key={o.clave}
            onPress={() => {
              setOrigen(o.clave);
              setHoja(null);
            }}
            style={({ pressed }) => [styles.filaHoja, pressed && styles.filaHojaTocada]}
            accessibilityRole="button"
            accessibilityState={{ selected: origen === o.clave }}
          >
            <Text style={styles.filaHojaTexto}>{o.etiqueta}</Text>
            {origen === o.clave ? (
              <Ionicons name="checkmark" size={20} color={tema.verde} />
            ) : null}
          </Pressable>
        ))}
      </HojaInferior>

      <HojaInferior visible={hoja === "agregar"} onCerrar={() => setHoja(null)}>
        <Text style={styles.hojaTitulo}>Agregar fotos</Text>
        <Pressable
          onPress={() => despuesDeCerrarLaHoja(elegirDeGaleria)}
          style={({ pressed }) => [styles.filaHoja, pressed && styles.filaHojaTocada]}
          accessibilityRole="button"
        >
          <Ionicons name="images-outline" size={22} color={tema.texto} />
          <Text style={[styles.filaHojaTexto, styles.filaHojaConIcono]}>
            Fotos del teléfono
          </Text>
        </Pressable>
        <Pressable
          onPress={() => despuesDeCerrarLaHoja(sacarFoto)}
          style={({ pressed }) => [styles.filaHoja, pressed && styles.filaHojaTocada]}
          accessibilityRole="button"
        >
          <Ionicons name="camera-outline" size={18} color={tema.texto} />
          <Text style={[styles.filaHojaTexto, styles.filaHojaConIcono]}>Cámara</Text>
        </Pressable>
      </HojaInferior>
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
  // 36 con el ícono en 18, la misma ✕ que `CabeceraDeHoja`.
  redondo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.lienzo,
  },
  redondoActivo: { backgroundColor: tema.verde50 },
  redondoTocado: { opacity: 0.6 },
  filaBuscar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: MARGEN,
    paddingBottom: 8,
  },
  buscador: { flex: 1, backgroundColor: tema.lienzo, borderRadius: 12, height: 40 },
  buscadorTexto: { fontSize: 15, minHeight: 0 },
  aviso: {
    color: "#c62828",
    fontSize: 12,
    paddingHorizontal: MARGEN,
    paddingBottom: 6,
  },
  subiendo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: MARGEN,
    paddingBottom: 6,
  },
  subiendoTexto: { color: tema.texto3, fontSize: 12 },
  cargando: { flex: 1, alignItems: "center", justifyContent: "center" },
  grilla: { paddingHorizontal: MARGEN, paddingBottom: 96, gap: SEPARACION },
  filaGrilla: { gap: SEPARACION },
  vacio: { padding: 24, color: tema.texto3, textAlign: "center" },
  celda: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: tema.lienzo,
    borderWidth: 2,
    borderColor: "transparent",
  },
  celdaMarcada: { borderColor: tema.verde },
  imagen: { width: "100%", height: "100%" },
  casilla: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#c8ccc9",
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { backgroundColor: tema.verde, borderColor: tema.verde },
  // La medida de la casa, la del *Guardar* de *Ordenar tareas*: 30 de alto,
  // 12 de costado, 13 semibold.
  pastilla: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  pastillaTexto: { fontSize: 13, fontWeight: "600", color: tema.texto },
  pastillaListo: { backgroundColor: tema.verde },
  pastillaListoTexto: { color: "#fff" },
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
  hojaTitulo: {
    fontSize: 17,
    fontWeight: "700",
    color: tema.texto,
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 8,
  },
  filaHoja: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea2,
  },
  filaHojaTocada: { backgroundColor: tema.lienzo },
  filaHojaTexto: { fontSize: 16, color: tema.texto },
  filaHojaConIcono: { flex: 1, marginLeft: 14 },
});
