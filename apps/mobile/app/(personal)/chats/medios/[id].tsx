import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Linking,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { MediaViewer, type MediaViewerSource } from "@/components/MediaViewer";
import { cuandoFue, type ArchivoDelChat, type EnlaceDelChat } from "@/lib/chats";
import { tema } from "@/lib/tema";

type Tipo = "archivos" | "enlaces";

/**
 * Lo que se mandó en el chat, aparte de leerlo: las fotos y videos en una
 * grilla de cuatro, y los mensajes con enlaces en una lista, del más nuevo
 * al más viejo y trayendo más al llegar abajo. Es la forma rápida de volver
 * a encontrar un archivo sin scrollear meses, como en WhatsApp. La misma
 * pantalla que el portal.
 */
export default function MediosDelChatScreen() {
  const { id, tipo: inicial } = useLocalSearchParams<{ id: string; tipo?: Tipo }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tipo, setTipo] = useState<Tipo>(inicial === "enlaces" ? "enlaces" : "archivos");
  const [archivos, setArchivos] = useState<ArchivoDelChat[]>([]);
  const [enlaces, setEnlaces] = useState<EnlaceDelChat[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<MediaViewerSource | null>(null);

  const traer = useCallback(
    async (cual: Tipo, desde: string | null) => {
      setCargando(true);
      try {
        const pagina = await apiRequest<{
          items: (ArchivoDelChat | EnlaceDelChat)[];
          cursor: string | null;
        }>(`/api/mobile/chats/${id}/medios`, {
          query: { tipo: cual, cursor: desde ?? undefined },
        });
        if (cual === "archivos") {
          setArchivos((a) => (desde ? [...a, ...(pagina.items as ArchivoDelChat[])] : (pagina.items as ArchivoDelChat[])));
        } else {
          setEnlaces((a) => (desde ? [...a, ...(pagina.items as EnlaceDelChat[])] : (pagina.items as EnlaceDelChat[])));
        }
        setCursor(pagina.cursor);
        setError(null);
      } catch (e) {
        setError(mensajeDeError(e, "No pudimos traer los archivos"));
      } finally {
        setCargando(false);
      }
    },
    [id]
  );

  useEffect(() => {
    traer(tipo, null);
  }, [tipo, traer]);

  const lado = Math.floor((width - 3) / 4);
  const fotos = archivos.filter((a) => a.tipo !== "video").length;
  const videos = archivos.length - fotos;

  const pestana = (cual: Tipo, etiqueta: string) => (
    <PressableScale
      onPress={() => {
        if (cual !== tipo) {
          setCursor(null);
          setTipo(cual);
        }
      }}
      style={[styles.pestana, tipo === cual && styles.pestanaActiva]}
    >
      <Text style={[styles.pestanaTexto, tipo === cual && styles.pestanaTextoActiva]}>
        {etiqueta}
      </Text>
    </PressableScale>
  );

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
          {pestana("archivos", "Fotos y videos")}
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
          onEndReached={() => {
            if (cursor && !cargando) traer("archivos", cursor);
          }}
          ListEmptyComponent={
            cargando ? (
              <ActivityIndicator style={styles.cargando} />
            ) : (
              <Text style={styles.vacio}>Todavía no se mandaron fotos ni videos.</Text>
            )
          }
          ListFooterComponent={
            archivos.length > 0 ? (
              <Text style={styles.pie}>
                {fotos} {fotos === 1 ? "foto" : "fotos"}, {videos} {videos === 1 ? "video" : "videos"}
                {cursor ? " cargados" : ""}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => setViendo({ url: item.url, tipo: item.tipo })}
              style={[styles.celda, { width: lado, height: lado }]}
            >
              {item.tipo === "video" ? (
                <View style={[styles.video, { width: lado, height: lado }]}>
                  <Ionicons name="play" size={28} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: item.url }} style={{ width: lado, height: lado }} />
              )}
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
          onEndReached={() => {
            if (cursor && !cargando) traer("enlaces", cursor);
          }}
          ListEmptyComponent={
            cargando ? (
              <ActivityIndicator style={styles.cargando} />
            ) : (
              <Text style={styles.vacio}>Todavía no se mandaron enlaces.</Text>
            )
          }
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
    marginHorizontal: 8,
    borderRadius: 999,
    backgroundColor: tema.lienzo,
  },
  pestana: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
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
});
