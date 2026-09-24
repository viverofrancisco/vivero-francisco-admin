import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { ActivityIndicator, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  extensionDe,
  tamanoLegible,
  urlParaMiniatura,
  urlParaVerGrande,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { MediaViewer, type MediaViewerSource } from "@/components/MediaViewer";
import {
  guardarMedios,
  leerMedios,
  type MediosEnCache,
  type TipoDeMedios,
} from "@/lib/cache-de-chats";
import { cuandoFue, type ArchivoDelChat, type EnlaceDelChat } from "@/lib/chats";
import { tema } from "@/lib/tema";

/**
 * Lo que se mandó en el chat, aparte de leerlo: las fotos y videos en una
 * grilla de cuatro, los mensajes con enlaces en una lista y los documentos
 * en otra, del más nuevo al más viejo y trayendo más al llegar abajo. Es la
 * forma rápida de volver a encontrar un archivo sin scrollear meses, como en
 * WhatsApp. La misma pantalla que el portal.
 *
 * **Se abre con la copia local**: la primera página de cada pestaña queda
 * guardada y se pinta al instante; el servidor la reemplaza detrás.
 */
export default function MediosDelChatScreen() {
  const { id, tipo: inicial } = useLocalSearchParams<{ id: string; tipo?: TipoDeMedios }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tipo, setTipo] = useState<TipoDeMedios>(
    inicial === "enlaces" || inicial === "documentos" ? inicial : "archivos"
  );
  /** Lo cargado, con el tipo al que pertenece: si no es el de la pestaña, se está cargando. */
  const [datos, setDatos] = useState<MediosEnCache | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<MediaViewerSource | null>(null);
  /** Para ignorar la respuesta de una pestaña que ya no es la elegida. */
  const pedido = useRef(0);

  const vigente = datos?.tipo === tipo ? datos : null;
  const cargando = vigente === null;

  useEffect(() => {
    const mio = ++pedido.current;
    let vivo = true;
    // La copia local primero, si el servidor todavía no contestó.
    leerMedios(id, tipo).then((copia) => {
      if (vivo && copia && mio === pedido.current) {
        setDatos((actual) => (actual?.tipo === tipo ? actual : copia));
      }
    });
    apiRequest<{ items: (ArchivoDelChat | EnlaceDelChat)[]; cursor: string | null }>(
      `/api/mobile/chats/${id}/medios`,
      { query: { tipo } }
    )
      .then((pagina) => {
        if (!vivo || mio !== pedido.current) return;
        const nuevos = { tipo, items: pagina.items, cursor: pagina.cursor };
        setDatos(nuevos);
        guardarMedios(id, nuevos);
        setError(null);
      })
      .catch((e) => vivo && setError(mensajeDeError(e, "No pudimos traer los archivos")));
    return () => {
      vivo = false;
    };
  }, [id, tipo]);

  const verMas = useCallback(async () => {
    if (!vigente?.cursor || cargandoMas) return;
    setCargandoMas(true);
    try {
      const pagina = await apiRequest<{
        items: (ArchivoDelChat | EnlaceDelChat)[];
        cursor: string | null;
      }>(`/api/mobile/chats/${id}/medios`, { query: { tipo, cursor: vigente.cursor } });
      setDatos((actual) =>
        actual?.tipo === tipo
          ? { ...actual, items: [...actual.items, ...pagina.items], cursor: pagina.cursor }
          : actual
      );
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos traer más"));
    } finally {
      setCargandoMas(false);
    }
  }, [id, tipo, vigente, cargandoMas]);

  const archivos = (vigente?.tipo === "archivos" ? vigente.items : []) as ArchivoDelChat[];
  const documentos = (vigente?.tipo === "documentos" ? vigente.items : []) as ArchivoDelChat[];
  const enlaces = (vigente?.tipo === "enlaces" ? vigente.items : []) as EnlaceDelChat[];
  const lado = Math.floor((width - 3) / 4);
  const fotos = archivos.filter((a) => a.tipo !== "video").length;
  const videos = archivos.length - fotos;

  const pestana = (cual: TipoDeMedios, etiqueta: string) => (
    <PressableScale
      onPress={() => setTipo(cual)}
      style={[styles.pestana, tipo === cual && styles.pestanaActiva]}
    >
      <Text style={[styles.pestanaTexto, tipo === cual && styles.pestanaTextoActiva]}>
        {etiqueta}
      </Text>
    </PressableScale>
  );

  const vacio = (texto: string) =>
    cargando ? <ActivityIndicator style={styles.cargando} /> : <Text style={styles.vacio}>{texto}</Text>;

  return (
    <View style={styles.pantalla}>
      <View style={[styles.cabecera, { paddingTop: insets.top + 8 }]}>
        <PressableScale
          onPress={() => router.back()}
          style={styles.iconoCabecera}
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={24} color={tema.texto} />
        </PressableScale>
        <View style={styles.pestanas}>
          {pestana("archivos", "Multimedia")}
          {pestana("documentos", "Documentos")}
          {pestana("enlaces", "Enlaces")}
        </View>
        <View style={styles.iconoCabecera} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tipo === "archivos" ? (
        <FlatList
          key="archivos"
          data={archivos}
          keyExtractor={(a) => a.id}
          numColumns={4}
          columnWrapperStyle={styles.filaGrilla}
          contentContainerStyle={styles.grilla}
          onEndReachedThreshold={0.4}
          onEndReached={verMas}
          ListEmptyComponent={vacio("Todavía no se mandaron fotos ni videos.")}
          ListFooterComponent={
            archivos.length > 0 ? (
              <Text style={styles.pie}>
                {fotos} {fotos === 1 ? "foto" : "fotos"}, {videos} {videos === 1 ? "video" : "videos"}
                {vigente?.cursor ? " cargados" : ""}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() =>
                setViendo({ url: urlParaVerGrande(item, width), tipo: item.tipo })
              }
              style={[styles.celda, { width: lado, height: lado }]}
            >
              {item.tipo === "video" ? (
                <View style={[styles.video, { width: lado, height: lado }]}>
                  <Ionicons name="play" size={28} color="#fff" />
                </View>
              ) : (
                <Image
                  source={{ uri: urlParaMiniatura(item) }}
                  style={{ width: lado, height: lado }}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              )}
            </PressableScale>
          )}
        />
      ) : tipo === "documentos" ? (
        <FlatList
          key="documentos"
          data={documentos}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.lista}
          onEndReachedThreshold={0.4}
          onEndReached={verMas}
          ListEmptyComponent={vacio("Todavía no se mandaron documentos.")}
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => Linking.openURL(item.url)}
              estiloExterno={styles.ancho}
              style={styles.documento}
            >
              <View style={styles.documentoIcono}>
                <Ionicons name="document-text-outline" size={22} color={tema.texto2} />
              </View>
              <View style={styles.crece}>
                <Text style={styles.documentoNombre} numberOfLines={2}>
                  {item.nombre ?? "Documento"}
                </Text>
                <Text style={styles.documentoDetalle}>
                  {[tamanoLegible(item.tamano), extensionDe(item.nombre), cuandoFue(item.createdAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </PressableScale>
          )}
        />
      ) : (
        <FlatList
          key="enlaces"
          data={enlaces}
          keyExtractor={(e) => e.mensajeId}
          contentContainerStyle={styles.lista}
          onEndReachedThreshold={0.4}
          onEndReached={verMas}
          ListEmptyComponent={vacio("Todavía no se mandaron enlaces.")}
          renderItem={({ item }) => (
            <View style={styles.tarjeta}>
              <View style={styles.tarjetaCuerpo}>
                <Text style={styles.autor}>
                  {item.autorNombre} · {cuandoFue(item.createdAt)}
                </Text>
                {item.urls.map((u) => (
                  <PressableScale
                    key={u}
                    onPress={() => Linking.openURL(u.startsWith("http") ? u : `https://${u}`)}
                    hitSlop={4}
                  >
                    <Text style={styles.enlace} numberOfLines={1}>
                      {u}
                    </Text>
                  </PressableScale>
                ))}
                <Text style={styles.texto} numberOfLines={2}>
                  {item.texto}
                </Text>
              </View>
              {/* Al mensaje, como en WhatsApp: la conversación se abre
                  alrededor de él. */}
              <PressableScale
                onPress={() =>
                  router.push({
                    pathname: "/(personal)/chats/[id]",
                    params: { id, mensaje: item.mensajeId },
                  })
                }
                estiloExterno={styles.ancho}
                style={styles.verMensaje}
              >
                <Text style={styles.verMensajeTexto}>Ver mensaje</Text>
                <Ionicons name="chevron-forward" size={16} color={tema.texto3} />
              </PressableScale>
            </View>
          )}
        />
      )}

      <MediaViewer media={viendo} onClose={() => setViendo(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  ancho: { alignSelf: "stretch" },
  crece: { flex: 1 },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingBottom: 8,
    backgroundColor: tema.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  iconoCabecera: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pestanas: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 2,
    padding: 2,
    marginHorizontal: 4,
    borderRadius: 999,
    backgroundColor: tema.lienzo,
  },
  pestana: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pestanaActiva: { backgroundColor: tema.superficie },
  pestanaTexto: { fontSize: 13, fontWeight: "600", color: tema.texto3 },
  pestanaTextoActiva: { color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
  grilla: { paddingBottom: 24, gap: 1 },
  filaGrilla: { gap: 1 },
  celda: { backgroundColor: tema.lienzo, overflow: "hidden" },
  video: { backgroundColor: "rgba(20,40,25,0.85)", alignItems: "center", justifyContent: "center" },
  cargando: { padding: 24 },
  vacio: { color: tema.texto3, textAlign: "center", padding: 40 },
  pie: { color: tema.texto3, textAlign: "center", fontSize: 12, paddingVertical: 12 },
  lista: { padding: 12, gap: 8 },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    overflow: "hidden",
  },
  tarjetaCuerpo: { paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  autor: { fontSize: 12, color: tema.texto3 },
  enlace: { fontSize: 14, fontWeight: "600", color: tema.verde700, textDecorationLine: "underline" },
  texto: { fontSize: 12, color: tema.texto3 },
  verMensaje: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  verMensajeTexto: { fontSize: 12, fontWeight: "600", color: tema.texto3 },
  documento: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
  },
  documentoIcono: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  documentoNombre: { fontSize: 14, fontWeight: "600", color: tema.texto },
  documentoDetalle: { fontSize: 12, color: tema.texto3, marginTop: 2 },
});
