import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { useAuthStore } from "@/lib/auth-store";
import { useColaDeEnvio } from "@/lib/cola-de-envio";
import { guardarLista, leerLista } from "@/lib/cache-de-chats";
import {
  cuandoFue,
  resumenDelUltimo,
  type ChatEnLista,
  type MensajeEncontrado,
} from "@/lib/chats";
import { tema } from "@/lib/tema";

/**
 * Los chats del equipo.
 *
 * **La misma pantalla que el portal en el teléfono**: un renglón por
 * conversación con lo último que se dijo y cuántos quedaron sin leer. Armar un
 * chat es del ADMIN —el ⋯ solo se lo ofrece a él—; leer y escribir, de quien
 * esté adentro.
 */
export default function ChatsListScreen() {
  const router = useRouter();
  const esAdmin = useAuthStore((s) => s.user?.role) === "ADMIN";
  const [items, setItems] = useState<ChatEnLista[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lo que quedó esperando en la cola sale apenas se abre esta pantalla, sin
  // tener que entrar al chat: es lo primero que se ve al volver a tener señal.
  const hidratarCola = useColaDeEnvio((s) => s.hidratar);
  useEffect(() => {
    hidratarCola();
  }, [hidratarCola]);

  /** Si el servidor ya contestó: la copia local no pisa lo que vino de él. */
  const delServidor = useRef(false);

  // La copia local primero: la lista se pinta sin esperar, y el servidor la
  // reemplaza cuando contesta.
  useEffect(() => {
    let vivo = true;
    leerLista().then((copia) => {
      if (!vivo || !copia || delServidor.current) return;
      setItems(copia);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Pedir la lista al servidor. **En silencio** salvo que alguien tire hacia
   * abajo: al volver de una conversación se recargaba con el spinner de
   * pantalla entera, porque el `useFocusEffect` leía una lista vacía capturada
   * en el primer render, y eso se veía como "la lista tiene que cargar" aunque
   * la copia local ya estuviera pintada. El spinner grande es solo del
   * arranque sin copia, y lo apaga el primero que conteste: la copia o el
   * servidor.
   */
  const cargar = useCallback(async (modo: "silencioso" | "tirando" = "silencioso") => {
    if (modo === "tirando") setRefrescando(true);
    try {
      const res = await apiRequest<{ items: ChatEnLista[] }>("/api/mobile/chats");
      delServidor.current = true;
      setItems(res.items);
      guardarLista(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar los chats"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  // Al volver de una conversación la lista tiene que reflejar lo leído y lo
  // que llegó mientras tanto, así que se recarga cada vez que entra en foco.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? items.filter((c) => c.nombre.toLowerCase().includes(q))
    : items;

  /*
   * Los mensajes los busca el servidor, no el teléfono: acá solo están los
   * chats, no lo que se dijo adentro. Busca en el texto y en el nombre de las
   * fotos, que es lo único por lo que se puede encontrar una imagen.
   */
  const [mensajes, setMensajes] = useState<MensajeEncontrado[]>([]);
  useEffect(() => {
    const texto = busqueda.trim();
    let vivo = true;
    // Un respiro antes de preguntar: si no, cada letra es una consulta.
    const tic = setTimeout(async () => {
      if (texto.length < 2) {
        setMensajes([]);
        return;
      }
      try {
        const res = await apiRequest<{ items: MensajeEncontrado[] }>(
          "/api/mobile/chats/buscar",
          { query: { q: texto } }
        );
        if (vivo) setMensajes(res.items);
      } catch {
        if (vivo) setMensajes([]);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(tic);
    };
  }, [busqueda]);

  return (
    <PantallaLista
      titulo="Chats"
      acciones={
        esAdmin
          ? [
              {
                etiqueta: "Nuevo chat",
                onPress: () => router.push("/(personal)/chats/nuevo"),
              },
            ]
          : []
      }
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar chat..."
    >
      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar("tirando")} />
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : null
          }
          ListFooterComponent={
            q && mensajes.length > 0 ? (
              <View>
                {/* Los chats arriba y los mensajes abajo, como en WhatsApp:
                    son dos preguntas distintas —"¿cómo se llamaba el grupo?"
                    y "¿dónde dijimos eso?"— y mezclarlas deja sin saber qué
                    se está mirando. */}
                <Text style={styles.seccion}>MENSAJES</Text>
                {mensajes.map((m) => (
                  <PressableScale
                    key={m.id}
                    onPress={() =>
                      router.push({
                        pathname: "/(personal)/chats/[id]",
                        params: { id: m.chatId, mensaje: m.id },
                      })
                    }
                    estiloExterno={styles.ancho}
                    style={FILA_LISTA}
                  >
                    {m.foto?.tipo === "video" ? (
                      <View style={[styles.fotoEncontrada, styles.videoCaja]}>
                        <Ionicons name="play" size={18} color="#fff" />
                      </View>
                    ) : m.foto ? (
                      <Image
                        source={{ uri: m.foto.url }}
                        style={styles.fotoEncontrada}
                      />
                    ) : (
                      <View style={styles.avatar}>
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={18}
                          color={tema.verde700}
                        />
                      </View>
                    )}
                    <View style={styles.texto}>
                      <View style={styles.renglon}>
                        <Text
                          variant="bodyLarge"
                          style={styles.nombre}
                          numberOfLines={1}
                        >
                          {m.chatNombre}
                        </Text>
                        <Text style={styles.cuando}>
                          {cuandoFue(m.createdAt)}
                        </Text>
                      </View>
                      <Text
                        variant="bodySmall"
                        style={styles.resumen}
                        numberOfLines={2}
                      >
                        {(m.mio ? "Tú: " : `${m.autorNombre}: `) +
                          (m.texto ??
                            m.foto?.nombre ??
                            (m.foto?.tipo === "video" ? "🎥 Video" : "📷 Foto"))}
                      </Text>
                    </View>
                  </PressableScale>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            q && mensajes.length > 0 ? null : (
            <View style={styles.vacio}>
              <Text variant="titleMedium" style={styles.vacioTitulo}>
                {q ? "Sin coincidencias" : "No estás en ningún chat"}
              </Text>
              <Text variant="bodyMedium" style={styles.vacioTexto}>
                {q
                  ? "Prueba con otro nombre."
                  : esAdmin
                    ? "Crea el primero y elige quién está adentro."
                    : "Cuando te agreguen a uno te llega un aviso."}
              </Text>
            </View>
            )
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() =>
                router.push({
                  pathname: "/(personal)/chats/[id]",
                  params: { id: item.id },
                })
              }
              estiloExterno={styles.ancho}
              style={FILA_LISTA}
            >
              <View style={styles.avatar}>
                <Ionicons name="chatbubbles" size={18} color={tema.verde700} />
              </View>
              <View style={styles.texto}>
                <View style={styles.renglon}>
                  <Text
                    variant="bodyLarge"
                    style={styles.nombre}
                    numberOfLines={1}
                  >
                    {item.nombre}
                  </Text>
                  {item.ultimo ? (
                    <Text style={styles.cuando}>
                      {cuandoFue(item.ultimo.createdAt)}
                    </Text>
                  ) : null}
                </View>
                <Text
                  variant="bodySmall"
                  style={[styles.resumen, item.sinLeer > 0 && styles.sinLeerTexto]}
                  numberOfLines={1}
                >
                  {item.ultimo
                    ? resumenDelUltimo(item.ultimo)
                    : `${item.miembros} ${item.miembros === 1 ? "persona" : "personas"}`}
                </Text>
              </View>
              {item.sinLeer > 0 ? (
                <View style={styles.globo}>
                  <Text style={styles.globoTexto}>{item.sinLeer}</Text>
                </View>
              ) : null}
            </PressableScale>
          )}
        />
      )}
    </PantallaLista>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  ancho: { alignSelf: "stretch" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
  texto: { flex: 1, gap: 2 },
  renglon: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  nombre: { flex: 1, color: tema.texto, fontWeight: "700" },
  cuando: { color: tema.texto3, fontSize: 11, fontWeight: "500" },
  resumen: { color: tema.texto3 },
  sinLeerTexto: { color: tema.texto2, fontWeight: "600" },
  globo: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  globoTexto: { color: "#fff", fontSize: 11, fontWeight: "700" },
  seccion: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: tema.texto3,
    backgroundColor: tema.lienzo,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  fotoEncontrada: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: tema.lienzo,
  },
  videoCaja: {
    backgroundColor: "rgba(20,40,25,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
