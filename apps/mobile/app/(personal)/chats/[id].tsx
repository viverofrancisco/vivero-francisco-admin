import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { MediaViewer } from "@/components/MediaViewer";
import {
  horaDeMensaje,
  mismoDia,
  tituloDelDia,
  type ChatDetalle,
  type MensajeDeChat,
} from "@/lib/chats";
import { tema } from "@/lib/tema";

/** Cada cuánto pregunta si llegó algo nuevo, con la pantalla abierta. */
const CADA_MS = 5000;

/**
 * Una conversación.
 *
 * **Pregunta cada cinco segundos en vez de esperar un empujón**: no hay
 * websockets en este sistema, y montarlos es mucho más de lo que hace falta
 * para que quince personas se pongan de acuerdo a qué hora salen. El aviso al
 * teléfono cubre la pantalla cerrada; esto, la abierta. Solo mientras está en
 * foco: un teléfono en el bolsillo con la app abierta no tiene por qué pedir
 * nada.
 *
 * La lista va **invertida**: así se pega abajo sola —que es donde empieza una
 * conversación— y el orden en que viene del servidor, del más nuevo al más
 * viejo, es justo el que necesita.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [chat, setChat] = useState<ChatDetalle | null>(null);
  const [mensajes, setMensajes] = useState<MensajeDeChat[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoViejos, setCargandoViejos] = useState(false);
  const [texto, setTexto] = useState("");
  const [respondiendo, setRespondiendo] = useState<MensajeDeChat | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [tocado, setTocado] = useState<MensajeDeChat | null>(null);
  const [viendo, setViendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enFoco = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const [detalle, pagina] = await Promise.all([
        apiRequest<ChatDetalle>(`/api/mobile/chats/${id}`),
        apiRequest<{ items: MensajeDeChat[]; cursor: string | null }>(
          `/api/mobile/chats/${id}/mensajes`
        ),
      ]);
      setChat(detalle);
      setMensajes(pagina.items);
      setCursor(pagina.cursor);
      setError(null);
      apiRequest(`/api/mobile/chats/${id}/leido`, { method: "POST" }).catch(
        () => {}
      );
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos abrir el chat"));
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Trae la página más nueva y pega lo que no estaba. */
  const buscarNuevos = useCallback(async () => {
    try {
      const pagina = await apiRequest<{ items: MensajeDeChat[] }>(
        `/api/mobile/chats/${id}/mensajes`
      );
      setMensajes((actuales) => {
        const conocidos = new Set(actuales.map((m) => m.id));
        const nuevos = pagina.items.filter((m) => !conocidos.has(m.id));
        if (nuevos.length === 0) {
          // Puede haber cambiado alguno de los que ya están —uno borrado—.
          const porId = new Map(pagina.items.map((m) => [m.id, m]));
          return actuales.map((m) => porId.get(m.id) ?? m);
        }
        return [...nuevos, ...actuales];
      });
      apiRequest(`/api/mobile/chats/${id}/leido`, { method: "POST" }).catch(
        () => {}
      );
    } catch {
      // Un pedido que falla no interrumpe nada: el siguiente lo intenta.
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      enFoco.current = true;
      const tic = setInterval(() => {
        if (enFoco.current) buscarNuevos();
      }, CADA_MS);
      return () => {
        enFoco.current = false;
        clearInterval(tic);
      };
    }, [buscarNuevos])
  );

  async function cargarViejos() {
    if (!cursor || cargandoViejos) return;
    setCargandoViejos(true);
    try {
      const pagina = await apiRequest<{
        items: MensajeDeChat[];
        cursor: string | null;
      }>(`/api/mobile/chats/${id}/mensajes?cursor=${cursor}`);
      setMensajes((actuales) => [...actuales, ...pagina.items]);
      setCursor(pagina.cursor);
    } catch {
      setAviso("No pudimos traer los mensajes anteriores");
    } finally {
      setCargandoViejos(false);
    }
  }

  async function enviar(fotos: { key: string; url: string }[] = []) {
    const cuerpo = texto.trim();
    if (!cuerpo && fotos.length === 0) return;
    setEnviando(true);
    try {
      const mensaje = await apiRequest<MensajeDeChat>(
        `/api/mobile/chats/${id}/mensajes`,
        {
          method: "POST",
          body: {
            texto: cuerpo || null,
            fotos,
            respondeAId: respondiendo?.id ?? null,
          },
        }
      );
      setMensajes((actuales) => [mensaje, ...actuales]);
      setTexto("");
      setRespondiendo(null);
      setAviso(null);
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos enviar el mensaje"));
    } finally {
      setEnviando(false);
    }
  }

  async function mandarFotos(assets: ImagePicker.ImagePickerAsset[]) {
    if (assets.length === 0) return;
    setSubiendo(true);
    try {
      const presign = await apiRequest<{
        uploads: { key: string; url: string; uploadUrl: string; contentType: string }[];
      }>(`/api/mobile/chats/${id}/fotos`, {
        method: "POST",
        body: {
          files: assets.map((a, i) => ({
            fileName: a.fileName ?? `foto-${i}.jpg`,
            contentType: a.mimeType ?? "image/jpeg",
          })),
        },
      });

      await Promise.all(
        presign.uploads.map(async (u, i) => {
          const blob = await (await fetch(assets[i].uri)).blob();
          const res = await fetch(u.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": u.contentType },
            body: blob,
          });
          if (!res.ok) throw new Error("No pudimos subir una de las fotos.");
        })
      );

      await enviar(presign.uploads.map((u) => ({ key: u.key, url: u.url })));
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos subir la foto"));
    } finally {
      setSubiendo(false);
    }
  }

  async function elegirDeGaleria() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.7,
    });
    if (!r.canceled) mandarFotos(r.assets);
  }

  async function sacarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!r.canceled) mandarFotos(r.assets);
  }

  async function borrar(mensaje: MensajeDeChat) {
    setTocado(null);
    try {
      await apiRequest(`/api/mobile/chats/mensajes/${mensaje.id}`, {
        method: "DELETE",
      });
      setMensajes((actuales) =>
        actuales.map((m) =>
          m.id === mensaje.id
            ? { ...m, borrado: true, texto: null, fotos: [] }
            : m
        )
      );
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos borrar el mensaje"));
    }
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const otros = chat?.miembros.filter((m) => !m.soyYo) ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* El encabezado: la flecha, el nombre y quiénes están. */}
      <View style={[styles.cabecera, { paddingTop: insets.top + 8 }]}>
        <PressableScale
          onPress={() => router.back()}
          style={styles.iconoCabecera}
          accessibilityLabel="Volver"
        >
          <Ionicons name="chevron-back" size={24} color={tema.texto} />
        </PressableScale>
        <View style={styles.crece}>
          <Text style={styles.titulo} numberOfLines={1}>
            {chat?.nombre ?? "Chat"}
          </Text>
          <Text style={styles.subtitulo} numberOfLines={1}>
            {otros.length === 0
              ? "Solo vos"
              : `Vos y ${otros.map((m) => m.nombre).join(", ")}`}
          </Text>
        </View>
        {chat?.puedeEditar ? (
          <PressableScale
            onPress={() => router.push(`/(personal)/chats/nuevo?id=${id}`)}
            style={styles.iconoCabecera}
            accessibilityLabel="Editar el chat"
          >
            <Ionicons name="create-outline" size={22} color={tema.texto2} />
          </PressableScale>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={mensajes}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={styles.lista}
        onEndReachedThreshold={0.3}
        onEndReached={cargarViejos}
        ListFooterComponent={
          cargandoViejos ? (
            <View style={styles.cargandoMas}>
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Text style={styles.vacioTexto}>
              Todavía no hay mensajes. Escribí el primero.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          // La lista está invertida: el "siguiente" en pantalla es el que en
          // el arreglo viene después, que es el más viejo.
          const anterior = mensajes[index + 1];
          const cambiaElDia =
            !anterior || !mismoDia(anterior.createdAt, item.createdAt);
          const mismoAutor =
            anterior && anterior.autorId === item.autorId && !cambiaElDia;
          return (
            <View>
              <Burbuja
                mensaje={item}
                conNombre={!item.mio && !mismoAutor}
                onMantener={() => {
                  Haptics.selectionAsync();
                  setTocado(item);
                }}
                onVerFoto={setViendo}
              />
              {cambiaElDia ? (
                <View style={styles.dia}>
                  <Text style={styles.diaTexto}>
                    {tituloDelDia(item.createdAt)}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
      />

      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

      {/* Lo que se está por mandar */}
      <View
        style={[
          styles.barra,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        {respondiendo ? (
          <View style={styles.citando}>
            <View style={styles.crece}>
              <Text style={styles.citandoAutor}>
                {respondiendo.mio ? "Vos" : respondiendo.autorNombre}
              </Text>
              <Text style={styles.citandoTexto} numberOfLines={1}>
                {respondiendo.texto ?? "📷 Foto"}
              </Text>
            </View>
            <PressableScale
              onPress={() => setRespondiendo(null)}
              style={styles.cerrarCita}
              accessibilityLabel="Cancelar la respuesta"
            >
              <Ionicons name="close" size={18} color={tema.texto3} />
            </PressableScale>
          </View>
        ) : null}

        <View style={styles.escribir}>
          <PressableScale
            onPress={elegirDeGaleria}
            onLongPress={sacarFoto}
            disabled={subiendo || enviando}
            style={styles.adjuntar}
            accessibilityLabel="Mandar una foto"
          >
            <Ionicons name="image-outline" size={22} color={tema.texto2} />
          </PressableScale>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribí un mensaje..."
            placeholderTextColor={tema.texto3}
            style={styles.campo}
            multiline
          />
          <PressableScale
            onPress={() => enviar()}
            disabled={enviando || subiendo || !texto.trim()}
            style={[
              styles.enviar,
              (enviando || subiendo || !texto.trim()) && styles.apagado,
            ]}
            accessibilityLabel="Enviar"
          >
            {subiendo ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </PressableScale>
        </View>
      </View>

      {/* Lo que se puede hacer con un mensaje. Mantener apretado, como en
          WhatsApp: en una burbuja no hay lugar para botones. */}
      <HojaInferior visible={tocado !== null} onCerrar={() => setTocado(null)}>
        <View style={styles.hoja}>
          <PressableScale
            onPress={() => {
              const m = tocado;
              setTocado(null);
              setRespondiendo(m);
            }}
            estiloExterno={styles.ancho}
            style={styles.opcion}
          >
            <Ionicons name="arrow-undo" size={20} color={tema.texto2} />
            <Text style={styles.opcionTexto}>Responder</Text>
          </PressableScale>
          {tocado?.texto ? (
            <PressableScale
              onPress={async () => {
                await Clipboard.setStringAsync(tocado.texto ?? "");
                setTocado(null);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              }}
              estiloExterno={styles.ancho}
              style={styles.opcion}
            >
              <Ionicons name="copy-outline" size={20} color={tema.texto2} />
              <Text style={styles.opcionTexto}>Copiar texto</Text>
            </PressableScale>
          ) : null}
          {tocado?.mio ? (
            <PressableScale
              onPress={() => tocado && borrar(tocado)}
              estiloExterno={styles.ancho}
              style={styles.opcion}
            >
              <Ionicons name="trash-outline" size={20} color={tema.rojo} />
              <Text style={[styles.opcionTexto, styles.borrarTexto]}>
                Borrar
              </Text>
            </PressableScale>
          ) : null}
        </View>
      </HojaInferior>

      <MediaViewer
        media={viendo ? { url: viendo, tipo: "imagen" } : null}
        onClose={() => setViendo(null)}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * Un mensaje. Lo mío a la derecha en verde, lo de los demás a la izquierda en
 * blanco: la convención que todo el mundo ya sabe leer.
 */
function Burbuja({
  mensaje,
  conNombre,
  onMantener,
  onVerFoto,
}: {
  mensaje: MensajeDeChat;
  conNombre: boolean;
  onMantener: () => void;
  onVerFoto: (url: string) => void;
}) {
  const mio = mensaje.mio;
  return (
    <PressableScale
      onLongPress={mensaje.borrado ? undefined : onMantener}
      delayLongPress={300}
      estiloExterno={[styles.fila, mio ? styles.aLaDerecha : styles.aLaIzquierda]}
      style={[styles.burbuja, mio ? styles.mia : styles.ajena]}
    >
      {conNombre ? (
        <Text style={styles.autor}>{mensaje.autorNombre}</Text>
      ) : null}

      {mensaje.respondeA ? (
        <View style={[styles.cita, mio ? styles.citaMia : styles.citaAjena]}>
          <Text style={[styles.citaAutor, mio && styles.textoClaro]}>
            {mensaje.respondeA.autorNombre}
          </Text>
          <Text
            style={[styles.citaCuerpo, mio && styles.textoClaro]}
            numberOfLines={2}
          >
            {mensaje.respondeA.borrado
              ? "Mensaje borrado"
              : (mensaje.respondeA.texto ??
                (mensaje.respondeA.fotos === 1
                  ? "📷 Foto"
                  : `📷 ${mensaje.respondeA.fotos} fotos`))}
          </Text>
        </View>
      ) : null}

      {mensaje.borrado ? (
        <Text style={[styles.borrado, mio && styles.textoClaro]}>
          Mensaje borrado
        </Text>
      ) : (
        <>
          {mensaje.fotos.length > 0 ? (
            <View style={styles.fotos}>
              {mensaje.fotos.map((f) => (
                <PressableScale
                  key={f.id}
                  onPress={() => onVerFoto(f.url)}
                  onLongPress={onMantener}
                  estiloExterno={
                    mensaje.fotos.length > 1 ? styles.mitad : styles.ancho
                  }
                  style={styles.fotoCaja}
                >
                  <Image source={{ uri: f.url }} style={styles.foto} />
                </PressableScale>
              ))}
            </View>
          ) : null}
          {mensaje.texto ? (
            <Text style={[styles.texto, mio && styles.textoClaro]}>
              {mensaje.texto}
            </Text>
          ) : null}
        </>
      )}

      <Text style={[styles.hora, mio && styles.horaMia]}>
        {horaDeMensaje(mensaje.createdAt)}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  crece: { flex: 1 },
  ancho: { alignSelf: "stretch" },

  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: tema.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  iconoCabecera: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 17, fontWeight: "700", color: tema.texto },
  subtitulo: { fontSize: 12, color: tema.texto3 },

  lista: { paddingHorizontal: 12, paddingVertical: 12, gap: 6 },
  cargandoMas: { paddingVertical: 16 },
  vacio: { paddingVertical: 40, alignItems: "center" },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  // La lista está invertida, así que el separador de día también.
  dia: { alignItems: "center", paddingVertical: 10, transform: [{ scaleY: -1 }] },
  diaTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.texto3,
    backgroundColor: tema.lienzo,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },

  fila: { maxWidth: "85%", transform: [{ scaleY: -1 }] },
  aLaDerecha: { alignSelf: "flex-end" },
  aLaIzquierda: { alignSelf: "flex-start" },
  burbuja: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  mia: { backgroundColor: tema.verde, borderBottomRightRadius: 4 },
  ajena: {
    backgroundColor: tema.superficie,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
  },
  autor: { fontSize: 12, fontWeight: "700", color: tema.verde700, marginBottom: 2 },
  texto: { fontSize: 15, color: tema.texto, lineHeight: 20 },
  textoClaro: { color: "#fff" },
  borrado: { fontSize: 15, fontStyle: "italic", color: tema.texto3 },
  hora: { fontSize: 10, color: tema.texto3, alignSelf: "flex-end", marginTop: 2 },
  horaMia: { color: "rgba(255,255,255,0.75)" },

  cita: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  citaMia: {
    borderLeftColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  citaAjena: { borderLeftColor: tema.verde, backgroundColor: tema.lienzo },
  citaAutor: { fontSize: 11, fontWeight: "700", color: tema.verde700 },
  citaCuerpo: { fontSize: 12, color: tema.texto2 },

  fotos: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 4 },
  mitad: { width: "48%" },
  fotoCaja: { borderRadius: 10, overflow: "hidden" },
  foto: { width: "100%", height: 150, backgroundColor: tema.lienzo },

  aviso: {
    color: tema.rojo,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },

  barra: {
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: tema.superficie,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea,
  },
  citando: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: tema.verde,
    backgroundColor: tema.lienzo,
  },
  citandoAutor: { fontSize: 12, fontWeight: "700", color: tema.verde700 },
  citandoTexto: { fontSize: 12, color: tema.texto3 },
  cerrarCita: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  escribir: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  adjuntar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  campo: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.fondo,
    fontSize: 15,
    color: tema.texto,
  },
  enviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  apagado: { opacity: 0.4 },

  hoja: { paddingHorizontal: 4, paddingBottom: 8, gap: 2 },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  opcionTexto: { fontSize: 15, fontWeight: "600", color: tema.texto },
  borrarTexto: { color: tema.rojo },
});
