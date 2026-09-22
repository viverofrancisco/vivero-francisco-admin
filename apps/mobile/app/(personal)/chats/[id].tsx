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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { MediaViewer } from "@/components/MediaViewer";
import {
  etiquetaDeAdjuntos,
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
 * Copiar al portapapeles, **sin que la pantalla dependa de ello**.
 *
 * `expo-clipboard` trae código nativo, así que un dev client compilado antes de
 * instalarlo no lo tiene. Importado arriba, eso no deja sin copiar: revienta al
 * evaluar el archivo, el módulo se queda sin export por defecto y la ruta entera
 * desaparece —"Unmatched Route" al abrir el chat—. Cargado acá adentro, el
 * módulo se evalúa recién al tocar "Copiar", así que lo único que falta hasta
 * que se reconstruya la app es copiar, y se avisa.
 */
async function copiarAlPortapapeles(mensaje: MensajeDeChat): Promise<boolean> {
  try {
    const Clipboard = await import("expo-clipboard");
    // El portapapeles del teléfono lleva una cosa por vez: el texto si lo hay,
    // y si no, la imagen —que es lo que hace WhatsApp con una foto sin pie—.
    // Un video no se copia: ningún portapapeles lo toma.
    if (mensaje.texto) {
      await Clipboard.setStringAsync(mensaje.texto);
      return true;
    }
    const foto = mensaje.fotos.find((f) => f.tipo !== "video");
    if (!foto) return false;
    const blob = await (await fetch(foto.url)).blob();
    const base64 = await new Promise<string>((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onerror = () => rechazar(lector.error);
      lector.onload = () =>
        resolver(String(lector.result).replace(/^data:[^;]+;base64,/, ""));
      lector.readAsDataURL(blob);
    });
    await Clipboard.setImageAsync(base64);
    return true;
  } catch {
    return false;
  }
}

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
  const { id, mensaje: destacado } = useLocalSearchParams<{
    id: string;
    /** Llegando desde el buscador: el mensaje que se vino a ver. */
    mensaje?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /**
   * Lo que mide la barra de pestañas, para descontárselo al teclado.
   *
   * `KeyboardAvoidingView` no sabe que abajo hay una barra que ya ocupa su
   * lugar, así que empuja de más: con el teclado abierto, por el alto de la
   * barra; y con teclado físico —el simulador reporta la barrita de
   * sugerencias como si fuera teclado— deja ese hueco blanco con todo cerrado.
   */
  const altoDeLasPestanas = useBottomTabBarHeight();

  const [chat, setChat] = useState<ChatDetalle | null>(null);
  const [mensajes, setMensajes] = useState<MensajeDeChat[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoViejos, setCargandoViejos] = useState(false);
  const [texto, setTexto] = useState("");
  const [respondiendo, setRespondiendo] = useState<MensajeDeChat | null>(null);
  const [enviando, setEnviando] = useState(false);
  /**
   * Las fotos elegidas que todavía no salieron.
   *
   * Antes se subían y se mandaban en el acto, así que una foto nunca podía
   * llevar texto ni juntarse con otra: cada una era su propio mensaje. Ahora
   * esperan acá —con su miniatura arriba del campo— y salen **con lo que se
   * escriba**, en un solo mensaje, como en WhatsApp.
   */
  const [pendientes, setPendientes] = useState<ImagePicker.ImagePickerAsset[]>(
    []
  );
  const [tocado, setTocado] = useState<MensajeDeChat | null>(null);
  const [viendo, setViendo] = useState<{ url: string; tipo: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enFoco = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const [detalle, pagina] = await Promise.all([
        apiRequest<ChatDetalle>(`/api/mobile/chats/${id}`),
        apiRequest<{ items: MensajeDeChat[]; cursor: string | null }>(
          `/api/mobile/chats/${id}/mensajes`,
          // Llegando desde el buscador, la conversación se abre **alrededor**
          // de ese mensaje y no por el final, que puede estar a cien mensajes
          // de lo que la persona vino a leer.
          destacado ? { query: { alrededorDe: destacado } } : undefined
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
  }, [id, destacado]);

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

  /** Sube lo que esté esperando y devuelve con qué crear el mensaje. */
  async function subirPendientes(): Promise<
    { key: string; url: string; nombre?: string; tipo: "imagen" | "video" }[]
  > {
    if (pendientes.length === 0) return [];
    const presign = await apiRequest<{
      uploads: {
        key: string;
        url: string;
        uploadUrl: string;
        contentType: string;
        tipo: "imagen" | "video";
      }[];
    }>(`/api/mobile/chats/${id}/fotos`, {
      method: "POST",
      body: {
        files: pendientes.map((a, i) => ({
          fileName:
            a.fileName ?? (a.type === "video" ? `video-${i}.mp4` : `foto-${i}.jpg`),
          contentType:
            a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg"),
        })),
      },
    });

    await Promise.all(
      presign.uploads.map(async (u, i) => {
        const blob = await (await fetch(pendientes[i].uri)).blob();
        const res = await fetch(u.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": u.contentType },
          body: blob,
        });
        if (!res.ok) throw new Error("No pudimos subir una de las fotos.");
      })
    );

    return presign.uploads.map((u, i) => ({
      key: u.key,
      url: u.url,
      // El nombre del archivo viaja porque es lo único por lo que después se
      // puede buscar una foto.
      nombre: pendientes[i].fileName ?? undefined,
      tipo: u.tipo,
    }));
  }

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo && pendientes.length === 0) return;
    setEnviando(true);
    try {
      const fotos = pendientes.length > 0 ? await subirPendientes() : [];
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
      setPendientes([]);
      setAviso(null);
    } catch (e) {
      setAviso(mensajeDeError(e, "No pudimos enviar el mensaje"));
    } finally {
      setEnviando(false);
    }
  }

  /** Elegir **no manda**: la foto espera arriba del campo hasta que se envíe. */
  function agregar(assets: ImagePicker.ImagePickerAsset[]) {
    if (assets.length === 0) return;
    setPendientes((actuales) => [...actuales, ...assets].slice(0, 10));
  }

  async function elegirDeGaleria() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.7,
    });
    if (!r.canceled) agregar(r.assets);
  }

  async function sacarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!r.canceled) agregar(r.assets);
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
      keyboardVerticalOffset={altoDeLasPestanas}
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
              ? "Solo tú"
              : `Tú y ${otros.map((m) => m.nombre).join(", ")}`}
          </Text>
        </View>
        {chat?.puedeEditar ? (
          <PressableScale
            onPress={() =>
              router.push({
                pathname: "/(personal)/chats/nuevo",
                params: { id },
              })
            }
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
              Todavía no hay mensajes. Escribe el primero.
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
              {/* El separador va **antes** de la burbuja: `inverted` da vuelta
                  el orden de las celdas, no lo que hay adentro de cada una. */}
              {cambiaElDia ? (
                <View style={styles.dia}>
                  <Text style={styles.diaTexto}>
                    {tituloDelDia(item.createdAt)}
                  </Text>
                </View>
              ) : null}
              <Burbuja
                mensaje={item}
                destacado={item.id === destacado}
                conNombre={!item.mio && !mismoAutor}
                onMantener={() => {
                  Haptics.selectionAsync();
                  setTocado(item);
                }}
                onVerFoto={setViendo}
              />
            </View>
          );
        }}
      />

      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}

      {/* Lo que se está por mandar */}
      {/* Sin `insets.bottom`: la barra de pestañas de abajo ya se corrió lo
          que hay que correrse por el indicador de inicio, así que sumarlo acá
          dejaba treinta y pico de píxeles en blanco entre el campo y las
          pestañas. */}
      <View style={styles.barra}>
        {respondiendo ? (
          <View style={styles.citando}>
            <View style={styles.crece}>
              <Text style={styles.citandoAutor}>
                {respondiendo.mio ? "Tú" : respondiendo.autorNombre}
              </Text>
              <Text style={styles.citandoTexto} numberOfLines={1}>
                {respondiendo.texto ??
                  etiquetaDeAdjuntos(
                    respondiendo.fotos[0]?.tipo,
                    respondiendo.fotos.length
                  )}
              </Text>
            </View>
            {respondiendo.fotos[0] ? (
              <MiniaturaAdjunto
                url={respondiendo.fotos[0].url}
                tipo={respondiendo.fotos[0].tipo}
                lado={40}
              />
            ) : null}
            <PressableScale
              onPress={() => setRespondiendo(null)}
              style={styles.cerrarCita}
              accessibilityLabel="Cancelar la respuesta"
            >
              <Ionicons name="close" size={18} color={tema.texto3} />
            </PressableScale>
          </View>
        ) : null}

        {pendientes.length > 0 ? (
          <View style={styles.bandeja}>
            {pendientes.map((a, i) => (
              <View key={a.uri} style={styles.miniatura}>
                {a.type === "video" ? (
                  <View style={[styles.miniaturaFoto, styles.videoCaja]}>
                    <Ionicons name="play" size={22} color="#fff" />
                  </View>
                ) : (
                  <Image source={{ uri: a.uri }} style={styles.miniaturaFoto} />
                )}
                <PressableScale
                  onPress={() =>
                    setPendientes((actuales) =>
                      actuales.filter((_, j) => j !== i)
                    )
                  }
                  style={styles.quitar}
                  accessibilityLabel="Quitar la foto"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </PressableScale>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.escribir}>
          <PressableScale
            onPress={elegirDeGaleria}
            onLongPress={sacarFoto}
            disabled={enviando}
            style={styles.adjuntar}
            accessibilityLabel="Mandar una foto"
          >
            <Ionicons name="image-outline" size={22} color={tema.texto2} />
          </PressableScale>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={tema.texto3}
            style={styles.campo}
            multiline
          />
          <PressableScale
            onPress={() => enviar()}
            // Se puede mandar con texto **o** con fotos esperando: una foto
            // sola es un mensaje, y con pie de foto también.
            disabled={enviando || (!texto.trim() && pendientes.length === 0)}
            style={[
              styles.enviar,
              (enviando || (!texto.trim() && pendientes.length === 0)) &&
                styles.apagado,
            ]}
            accessibilityLabel="Enviar"
          >
            {enviando ? (
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
          {tocado && (tocado.texto || tocado.fotos.some((f) => f.tipo !== "video")) ? (
            <PressableScale
              onPress={async () => {
                const m = tocado;
                setTocado(null);
                if (await copiarAlPortapapeles(m)) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  );
                } else {
                  setAviso(
                    "Para copiar hay que reinstalar la app: el portapapeles necesita una versión nueva."
                  );
                }
              }}
              estiloExterno={styles.ancho}
              style={styles.opcion}
            >
              <Ionicons name="copy-outline" size={20} color={tema.texto2} />
              <Text style={styles.opcionTexto}>Copiar</Text>
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

      <MediaViewer media={viendo} onClose={() => setViendo(null)} />
    </KeyboardAvoidingView>
  );
}

/**
 * Un mensaje. Lo mío a la derecha en verde, lo de los demás a la izquierda en
 * blanco: la convención que todo el mundo ya sabe leer.
 */
function Burbuja({
  mensaje,
  destacado = false,
  conNombre,
  onMantener,
  onVerFoto,
}: {
  mensaje: MensajeDeChat;
  /** El que se vino a ver desde el buscador. */
  destacado?: boolean;
  conNombre: boolean;
  onMantener: () => void;
  onVerFoto: (media: { url: string; tipo: string }) => void;
}) {
  const mio = mensaje.mio;
  return (
    <PressableScale
      onLongPress={mensaje.borrado ? undefined : onMantener}
      delayLongPress={300}
      estiloExterno={[styles.fila, mio ? styles.aLaDerecha : styles.aLaIzquierda]}
      style={[
        styles.burbuja,
        mio ? styles.mia : styles.ajena,
        destacado && styles.destacada,
      ]}
    >
      {conNombre ? (
        <Text style={styles.autor}>{mensaje.autorNombre}</Text>
      ) : null}

      {mensaje.respondeA ? (
        <View style={[styles.cita, mio ? styles.citaMia : styles.citaAjena]}>
          <View style={styles.crece}>
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
                  etiquetaDeAdjuntos(
                    mensaje.respondeA.miniatura?.tipo,
                    mensaje.respondeA.fotos
                  ))}
            </Text>
          </View>
          {/* La miniatura de lo citado, como en WhatsApp: "📷 Foto" no dice
              cuál de todas. */}
          {mensaje.respondeA.miniatura ? (
            <MiniaturaAdjunto
              url={mensaje.respondeA.miniatura.url}
              tipo={mensaje.respondeA.miniatura.tipo}
              lado={36}
            />
          ) : null}
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
                  onPress={() => onVerFoto({ url: f.url, tipo: f.tipo })}
                  onLongPress={onMantener}
                  style={styles.fotoCaja}
                >
                  {/* Medidas fijas y no porcentajes: adentro de una burbuja
                      que se mide por su contenido, un `100%` no tiene contra
                      qué resolverse —quedaba de ancho cero y alto estirado—. */}
                  {f.tipo === "video" ? (
                    <View
                      style={[
                        mensaje.fotos.length > 1 ? styles.fotoChica : styles.fotoSola,
                        styles.videoCaja,
                      ]}
                    >
                      <Ionicons name="play" size={36} color="#fff" />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: f.url }}
                      style={
                        mensaje.fotos.length > 1 ? styles.fotoChica : styles.fotoSola
                      }
                    />
                  )}
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

/** La miniatura chica de una foto o un video, para las citas. */
function MiniaturaAdjunto({
  url,
  tipo,
  lado,
}: {
  url: string;
  tipo: string;
  lado: number;
}) {
  const caja = { width: lado, height: lado };
  if (tipo === "video") {
    return (
      <View style={[styles.miniaturaCita, styles.videoCaja, caja]}>
        <Ionicons name="play" size={lado / 2} color="#fff" />
      </View>
    );
  }
  return (
    <Image source={{ uri: url }} style={[styles.miniaturaCita, caja]} />
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
  titulo: { fontSize: 16, fontWeight: "700", color: tema.texto },
  subtitulo: { fontSize: 12, color: tema.texto3 },

  /* Apretado como WhatsApp: los mensajes seguidos casi se tocan —dos píxeles—
     y lo que separa es el cambio de quién habla, no el aire. */
  lista: { paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  cargandoMas: { paddingVertical: 16 },
  vacio: { paddingVertical: 40, alignItems: "center" },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  dia: { alignItems: "center", paddingVertical: 6 },
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

  // **Sin `scaleY: -1`.** `inverted` ya da vuelta cada celda por su cuenta;
  // dar vuelta también el contenido lo dejaba espejado, con el texto al revés.
  fila: { maxWidth: "85%" },
  aLaDerecha: { alignSelf: "flex-end" },
  aLaIzquierda: { alignSelf: "flex-start" },
  burbuja: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  mia: { backgroundColor: tema.verde, borderBottomRightRadius: 4 },
  /* El que se vino a ver: un borde ámbar, que es lo único que lo distingue sin
     taparle el contenido. */
  destacada: { borderWidth: 2, borderColor: tema.ambar },
  ajena: {
    backgroundColor: tema.superficie,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
  },
  autor: { fontSize: 12, fontWeight: "700", color: tema.verde700, marginBottom: 2 },
  texto: { fontSize: 15, color: tema.texto, lineHeight: 19 },
  textoClaro: { color: "#fff" },
  borrado: { fontSize: 15, fontStyle: "italic", color: tema.texto3 },
  hora: { fontSize: 10, color: tema.texto3, alignSelf: "flex-end", marginTop: 1 },
  horaMia: { color: "rgba(255,255,255,0.75)" },

  cita: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  /* Un video no tiene imagen sin reproducirlo: un recuadro oscuro con el
     triángulo es lo que todo el mundo lee como "esto se reproduce". */
  videoCaja: {
    backgroundColor: "rgba(20,40,25,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniaturaCita: { borderRadius: 6, overflow: "hidden", backgroundColor: tema.lienzo },
  citaMia: {
    borderLeftColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  citaAjena: { borderLeftColor: tema.verde, backgroundColor: tema.lienzo },
  citaAutor: { fontSize: 11, fontWeight: "700", color: tema.verde700 },
  citaCuerpo: { fontSize: 12, color: tema.texto2 },

  fotos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginBottom: 4,
    // Dos por fila cuando hay varias: 105 + 3 + 105.
    maxWidth: 213,
  },
  fotoCaja: { borderRadius: 10, overflow: "hidden" },
  fotoSola: { width: 213, height: 160, backgroundColor: tema.lienzo },
  fotoChica: { width: 105, height: 105, backgroundColor: tema.lienzo },

  aviso: {
    color: tema.rojo,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },

  barra: {
    paddingHorizontal: 8,
    paddingVertical: 6,
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
  /* Las fotos que están por salir, arriba del campo: se ven, se sacan de la
     tanda con su ✕, y recién salen cuando alguien toca enviar. */
  bandeja: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  miniatura: { width: 56, height: 56, borderRadius: 8, overflow: "hidden" },
  miniaturaFoto: { width: "100%", height: "100%", backgroundColor: tema.lienzo },
  quitar: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
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
    // 40 de mínimo, los mismos que los botones de al lado: con 10 arriba y 10
    // abajo el alto propio del campo se pasaba de eso —iOS le suma lo suyo en
    // los multilínea— y la fila quedaba despareja con el campo vacío.
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
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
