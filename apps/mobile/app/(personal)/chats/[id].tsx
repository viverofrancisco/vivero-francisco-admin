import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import {
  esContenidoPermitidoEnChat,
  mezclarConLaCola,
  nuevoIdCliente,
  puedeAbrirReferencia,
  SIN_ACCESO_A,
  type FotoEnCola,
  type MensajeEnCola,
  type ReferenciaEnMensaje,
  type TipoDeReferencia,
} from "@vivero/shared";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { onEnviado, useColaDeEnvio } from "@/lib/cola-de-envio";
import { guardarChat, leerChat } from "@/lib/cache-de-chats";
import { PressableScale } from "@/components/ui/PressableScale";
import { Conectando } from "@/components/ui/Conectando";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { MediaViewer } from "@/components/MediaViewer";
import {
  Burbuja,
  ETIQUETA_REFERENCIA,
  ICONO_REFERENCIA,
  MiniaturaAdjunto,
} from "@/components/chats/Burbuja";
import { AvatarDeChat } from "@/components/chats/AvatarDeChat";
import { FilaDeslizable } from "@/components/chats/FilaDeslizable";
import { PanelAdjuntar, type OpcionDeAdjuntar } from "@/components/chats/PanelAdjuntar";
import { SelectorDeGaleria } from "@/components/SelectorDeGaleria";
import type { ArchivoDeGaleria } from "@/lib/galeria";
import { VistaPreviaDeFicha } from "@/components/chats/VistaPreviaDeFicha";
import {
  etiquetaDeAdjuntos,
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
    const foto = mensaje.fotos.find((f) => f.tipo === "imagen");
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
 *
 * **Lo que se escribe aparece en el acto y sale después**, por la cola de
 * `lib/cola-de-envio.ts`: la lista que se dibuja es lo que vino del servidor
 * más lo que espera en la cola, y un mensaje que vuelve del servidor con el
 * `idCliente` de uno de la cola es ese mismo, ya llegado.
 *
 * **Y se abre al instante** con la copia local (`lib/cache-de-chats.ts`): la
 * última tanda que se guardó se pinta mientras se pregunta, y lo que llega la
 * reemplaza entera.
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
  /**
   * Los adjuntos elegidos que todavía no salieron: fotos, videos y documentos.
   *
   * Esperan acá —con su miniatura arriba del campo— y salen **con lo que se
   * escriba**, en un solo mensaje, como en WhatsApp. Ya vienen con la forma
   * que la cola necesita, vengan de la galería, la cámara o el selector de
   * documentos: un archivo del teléfono, su nombre, su tipo y su peso.
   */
  const [pendientes, setPendientes] = useState<FotoEnCola[]>([]);
  /** La galería propia, abierta desde *Multimedia*. */
  const [galeriaAbierta, setGaleriaAbierta] = useState(false);
  const [tocado, setTocado] = useState<MensajeDeChat | null>(null);
  /** La ficha para compartir —visita, cliente o producto—, esperando arriba del campo. */
  const [referencia, setReferencia] = useState<ReferenciaEnMensaje | null>(null);
  /** El menú del clip, y el selector abierto con su tipo. */
  const [menuAdjuntar, setMenuAdjuntar] = useState(false);
  const [compartiendo, setCompartiendo] = useState<TipoDeReferencia | null>(null);
  /** La ficha compartida que se está mirando sin salir del chat. */
  const [vistaPrevia, setVistaPrevia] = useState<ReferenciaEnMensaje | null>(null);
  /**
   * El mensaje resaltado: el que trajo el buscador, o el que se citó y se
   * acaba de tocar. Es un destello y no una marca fija —se apaga solo a los
   * dos segundos—, porque una vez que la vista llegó ahí ya cumplió.
   */
  const [resaltado, setResaltado] = useState<string | null>(destacado ?? null);
  useEffect(() => {
    if (!resaltado) return;
    const t = setTimeout(() => setResaltado(null), 2000);
    return () => clearTimeout(t);
  }, [resaltado]);
  const lista = useRef<FlatList<MensajeDeChat>>(null);
  /** A dónde había que ir cuando la lista todavía no había medido esa fila. */
  const pendienteDeIr = useRef<number | null>(null);

  /** Quien escribe, para dibujar lo suyo antes de que el servidor conteste. */
  const usuario = useAuthStore((s) => s.user);
  const yo = useMemo(
    () => ({
      id: usuario?.id ?? "",
      nombre:
        [usuario?.name, usuario?.apellido].filter(Boolean).join(" ") ||
        usuario?.usuario ||
        usuario?.email ||
        "Tú",
    }),
    [usuario]
  );

  /** La cola de salida: lo que espera de este chat va al final de la lista. */
  const cola = useColaDeEnvio((s) => s.items);
  const hidratarCola = useColaDeEnvio((s) => s.hidratar);
  const encolar = useColaDeEnvio((s) => s.encolar);
  const reintentar = useColaDeEnvio((s) => s.reintentar);
  const descartar = useColaDeEnvio((s) => s.descartar);
  const confirmarLlegada = useColaDeEnvio((s) => s.confirmarLlegada);
  const procesarCola = useColaDeEnvio((s) => s.procesar);
  useEffect(() => {
    hidratarCola();
  }, [hidratarCola]);

  // La lista está invertida —del más nuevo al más viejo— y la cola se junta
  // por el otro lado: se da vuelta, se mezcla, se vuelve a dar vuelta.
  const enPantalla = useMemo(
    () =>
      mezclarConLaCola(
        [...mensajes].reverse(),
        cola.filter((i) => i.chatId === id),
        yo
      ).reverse(),
    [mensajes, cola, id, yo]
  );

  /**
   * Ir a un mensaje: al que cita una respuesta. Si está cargado, la lista se
   * desplaza hasta él y se lo hace destellar; si quedó más atrás de lo que se
   * trajo, se vuelve a pedir la conversación alrededor de él, como hace el
   * buscador, y recién entonces se va.
   */
  async function irAlMensaje(mensajeId: string) {
    const i = enPantalla.findIndex((m) => m.id === mensajeId);
    if (i >= 0) {
      lista.current?.scrollToIndex({ index: i, viewPosition: 0.5, animated: true });
      setResaltado(mensajeId);
      return;
    }
    try {
      const pagina = await apiRequest<{
        items: MensajeDeChat[];
        cursor: string | null;
      }>(`/api/mobile/chats/${id}/mensajes`, {
        query: { alrededorDe: mensajeId },
      });
      // Desde acá lo que hay en pantalla es el medio del chat, no su final.
      esElFinal.current = false;
      setMensajes(pagina.items);
      setCursor(pagina.cursor);
      const j = pagina.items.findIndex((m) => m.id === mensajeId);
      if (j >= 0) {
        // La lista recién va a tener estas filas en el próximo render.
        pendienteDeIr.current = j;
        setResaltado(mensajeId);
      }
    } catch {
      setAviso("No pudimos llegar a ese mensaje");
    }
  }

  useEffect(() => {
    if (pendienteDeIr.current === null) return;
    const j = pendienteDeIr.current;
    pendienteDeIr.current = null;
    // Un tick, para que la lista haya montado las filas nuevas.
    const t = setTimeout(
      () => lista.current?.scrollToIndex({ index: j, viewPosition: 0.5, animated: true }),
      50
    );
    return () => clearTimeout(t);
  }, [mensajes]);
  const [viendo, setViendo] = useState<{ url: string; tipo: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const enFoco = useRef(true);
  /** Si el servidor ya contestó: la copia local no pisa lo que vino de él. */
  const delServidor = useRef(false);
  /** Si lo que hay en pantalla es el final del chat, que es lo único que se guarda. */
  const esElFinal = useRef(!destacado);

  // La copia local primero: se pinta sin esperar, y el spinner no aparece.
  useEffect(() => {
    if (destacado) return;
    let vivo = true;
    leerChat(id).then((copia) => {
      if (!vivo || !copia || delServidor.current) return;
      setChat(copia.chat);
      setMensajes(copia.items);
      setCursor(copia.cursor);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [id, destacado]);

  // Y cada vez que cambia lo que se ve, la copia se vuelve a guardar: con lo
  // que el servidor dijo de cada mensaje, que es lo que la mantiene honesta.
  useEffect(() => {
    if (!delServidor.current || !esElFinal.current || !chat) return;
    guardarChat(id, chat, mensajes, cursor);
  }, [id, chat, mensajes, cursor]);

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
      delServidor.current = true;
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

  // Un mensaje de la cola que volvió del servidor se pega a la lista acá, sin
  // esperar al próximo sondeo: es lo que hace que el ✓ pase a ✓✓ al instante.
  useEffect(
    () =>
      onEnviado((chatId, m) => {
        if (chatId !== id) return;
        setMensajes((actuales) =>
          actuales.some((x) => x.id === m.id) ? actuales : [m, ...actuales]
        );
      }),
    [id]
  );

  /** Trae la página más nueva y pega lo que no estaba. */
  const buscarNuevos = useCallback(async () => {
    try {
      const pagina = await apiRequest<{ items: MensajeDeChat[] }>(
        `/api/mobile/chats/${id}/mensajes`
      );
      // Lo que estaba en la cola y ya vino por acá, dejó de esperar.
      pagina.items.forEach((m) => {
        if (m.idCliente) confirmarLlegada(m.idCliente);
      });
      delServidor.current = true;
      setMensajes((actuales) => {
        const conocidos = new Set(actuales.map((m) => m.id));
        const nuevos = pagina.items.filter((m) => !conocidos.has(m.id));
        // Los conocidos se refrescan siempre: cambia el estado —lo leyeron—
        // o uno se borró, sin perder los viejos de abajo.
        const porId = new Map(pagina.items.map((m) => [m.id, m]));
        const refrescados = actuales.map((m) => porId.get(m.id) ?? m);
        return nuevos.length === 0 ? refrescados : [...nuevos, ...refrescados];
      });
      apiRequest(`/api/mobile/chats/${id}/leido`, { method: "POST" }).catch(
        () => {}
      );
    } catch {
      // Un pedido que falla no interrumpe nada: el siguiente lo intenta.
    }
    // Y lo que esté esperando en la cola, que lo vuelva a intentar.
    void procesarCola();
  }, [id, confirmarLlegada, procesarCola]);

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

  /**
   * Enviar: a la cola, y a la pantalla en el acto. Lo que se escribió se
   * limpia ya, porque el mensaje ya está en la conversación con su ✓; si el
   * servidor lo rechaza, aparece ahí mismo con su motivo y sus dos botones.
   */
  function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo && pendientes.length === 0 && !referencia) return;
    const item: MensajeEnCola = {
      idCliente: nuevoIdCliente(),
      chatId: id,
      texto: cuerpo || null,
      fotos: pendientes,
      respondeA: respondiendo
        ? {
            id: respondiendo.id,
            autorNombre: respondiendo.autorNombre,
            texto: respondiendo.texto,
            borrado: respondiendo.borrado,
            fotos: respondiendo.fotos.length,
            miniatura: respondiendo.fotos[0]
              ? { url: respondiendo.fotos[0].url, tipo: respondiendo.fotos[0].tipo }
              : null,
          }
        : null,
      referencia,
      creadoEl: new Date().toISOString(),
      estado: "pendiente",
    };
    encolar(item);
    setTexto("");
    setRespondiendo(null);
    setReferencia(null);
    setPendientes([]);
    setAviso(null);
  }

  /** Tocar una ficha compartida abre la ficha de ahora, si se puede ver. */
  /** Tocar la tarjeta abre la vista previa; la ficha entera es *Ver ficha* desde ahí. */
  function abrirReferencia(ref: ReferenciaEnMensaje) {
    // La tarjeta se ve igual para todos; la que el rol no abre lo dice acá,
    // al tocarla, sin pedir una vista previa que va a fallar.
    if (!puedeAbrirReferencia(usuario?.role ?? "", ref.tipo)) {
      Alert.alert(SIN_ACCESO_A[ref.tipo]);
      return;
    }
    setVistaPrevia(ref);
  }

  function irAFicha(ref: ReferenciaEnMensaje) {
    if (ref.tipo === "visita") {
      router.push({ pathname: "/(personal)/visitas/[id]", params: { id: ref.id } });
    } else if (ref.tipo === "cliente") {
      router.push({ pathname: "/(personal)/clientes/[id]", params: { id: ref.id } });
    } else {
      router.push({ pathname: "/(personal)/servicios/[id]", params: { id: ref.id } });
    }
  }

  /** Elegir **no manda**: el archivo espera arriba del campo hasta que se envíe. */
  function agregar(assets: ImagePicker.ImagePickerAsset[]) {
    if (assets.length === 0) return;
    const nuevos: FotoEnCola[] = assets.map((a, i) => ({
      uri: a.uri,
      // El nombre del archivo viaja porque es lo único por lo que después
      // se puede buscar una foto.
      nombre: a.fileName ?? (a.type === "video" ? `video-${i}.mp4` : `foto-${i}.jpg`),
      contentType: a.mimeType ?? (a.type === "video" ? "video/mp4" : "image/jpeg"),
      tipo: a.type === "video" ? "video" : "imagen",
      tamano: a.fileSize ?? null,
    }));
    setPendientes((actuales) => [...actuales, ...nuevos].slice(0, 10));
  }

  /**
   * Un documento: PDF, Word, Excel, PowerPoint, texto o ZIP. Con copia en la
   * caché de la app, porque lo que da el selector puede ser un archivo de
   * otra app que después no se deja leer; y filtrado acá con la misma regla
   * que el servidor, para avisar antes de subir y no después.
   */
  async function elegirDocumento() {
    const r = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (r.canceled) return;
    const nuevos: FotoEnCola[] = [];
    let rechazados = 0;
    for (const a of r.assets) {
      const contentType = a.mimeType ?? "application/octet-stream";
      if (!esContenidoPermitidoEnChat(contentType)) {
        rechazados++;
        continue;
      }
      nuevos.push({
        uri: a.uri,
        nombre: a.name,
        contentType,
        tipo: contentType.startsWith("image/")
          ? "imagen"
          : contentType.startsWith("video/")
            ? "video"
            : "documento",
        tamano: a.size ?? null,
      });
    }
    if (rechazados > 0) {
      setAviso("Solo se pueden mandar imágenes, videos y documentos (PDF, Word, Excel, PowerPoint, texto o ZIP).");
    }
    setPendientes((actuales) => [...actuales, ...nuevos].slice(0, 10));
  }

  /**
   * La galería propia (`SelectorDeGaleria`), no la del sistema. La del
   * sistema arrancaba en blanco cada vez: con tres fotos en la bandeja, volver
   * a la galería para agregar una cuarta no mostraba las tres, y elegir una
   * repetida la duplicaba. Esta abre con las que ya están marcadas, y lo que
   * devuelve **reemplaza** lo que había venido de la galería; lo de la cámara
   * y los documentos se queda donde estaba.
   */
  function elegirDeGaleria() {
    setGaleriaAbierta(true);
  }

  function alConfirmarGaleria(archivos: ArchivoDeGaleria[]) {
    setGaleriaAbierta(false);
    setPendientes((actuales) => {
      const otros = actuales.filter((a) => !a.assetId);
      const deGaleria: FotoEnCola[] = archivos.map((f) => ({
        uri: f.uri,
        nombre: f.fileName,
        contentType: f.contentType,
        tipo: f.tipo,
        tamano: null,
        assetId: f.assetId,
      }));
      return [...otros, ...deGaleria].slice(0, 10);
    });
  }

  /**
   * La cámara del sistema. Con fotos y videos juntos, iOS abre la cámara con
   * el selector de foto/video; Android (`toCameraIntentAction` en
   * expo-image-picker) solo graba video cuando se le pide *únicamente* video,
   * así que ahí saca fotos y el video se manda desde la galería.
   */
  async function sacarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.7,
    });
    if (!r.canceled) agregar(r.assets);
  }

  /**
   * Lo elegido en el + . Los selectores del sistema esperan un instante: se
   * presentan sobre la pantalla, y si la hoja todavía se está yendo iOS los
   * rechaza sin decir nada.
   */
  function alElegirAdjunto(opcion: OpcionDeAdjuntar) {
    if (opcion === "camara") setTimeout(sacarFoto, 150);
    else if (opcion === "fotos") setTimeout(elegirDeGaleria, 150);
    else if (opcion === "documento") setTimeout(elegirDocumento, 150);
    else setCompartiendo(opcion);
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

  /** La info de un mensaje propio: quién lo leyó y cuándo. */
  function verInfo(mensaje: MensajeDeChat) {
    router.push({
      pathname: "/(personal)/chats/info/[mensajeId]",
      params: { mensajeId: mensaje.id },
    });
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const otros = chat?.miembros.filter((m) => !m.soyYo) ?? [];
  const hayQueMandar = Boolean(texto.trim()) || pendientes.length > 0 || referencia !== null;
  // Un jardinero comparte sus visitas; los clientes y el catálogo son de la
  // oficina, y el servidor lo rechazaría igual.
  const esOficina = usuario?.role === "ADMIN" || usuario?.role === "STAFF";

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
        {/* El nombre **es** el botón de la info, como en WhatsApp: tocarlo
            abre la foto, la gente y los archivos. El lápiz que había vive
            ahora adentro, en el ⋯ de la info. */}
        <PressableScale
          onPress={() =>
            router.push({
              pathname: "/(personal)/chats/detalle/[id]",
              params: { id },
            })
          }
          estiloExterno={styles.crece}
          style={styles.cabeceraTocable}
          accessibilityLabel="Info del chat"
        >
          <AvatarDeChat imagenUrl={chat?.imagenUrl} lado={36} />
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
        </PressableScale>
      </View>

      <Conectando />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        ref={lista}
        data={enPantalla}
        keyExtractor={(m) => m.id}
        inverted
        // Las filas miden distinto y la lista no las conoce hasta dibujarlas:
        // si pide una que todavía no midió, se acerca a ojo y vuelve a
        // intentar cuando ya la tiene.
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          lista.current?.scrollToOffset({
            offset: index * averageItemLength,
            animated: false,
          });
          setTimeout(
            () =>
              lista.current?.scrollToIndex({
                index,
                viewPosition: 0.5,
                animated: true,
              }),
            100
          );
        }}
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
          const anterior = enPantalla[index + 1];
          const cambiaElDia =
            !anterior || !mismoDia(anterior.createdAt, item.createdAt);
          const mismoAutor =
            anterior && anterior.autorId === item.autorId && !cambiaElDia;
          const enCola =
            item.estado === "pendiente" || item.estado === "fallido";
          const seMueve = !item.borrado && !enCola;
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
              <FilaDeslizable
                alineado={item.mio ? "derecha" : "izquierda"}
                onDerecha={seMueve ? () => setRespondiendo(item) : undefined}
                onIzquierda={seMueve && item.mio ? () => verInfo(item) : undefined}
              >
                <Burbuja
                  mensaje={item}
                  destacado={item.id === resaltado}
                  conNombre={!item.mio && !mismoAutor}
                  onIrACita={irAlMensaje}
                  onMantener={() => {
                    Haptics.selectionAsync();
                    setTocado(item);
                  }}
                  onVerFoto={setViendo}
                  onReintentar={() => item.idCliente && reintentar(item.idCliente)}
                  onDescartar={() => item.idCliente && descartar(item.idCliente)}
                  onAbrirReferencia={abrirReferencia}
                />
              </FilaDeslizable>
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

        {/* La ficha que se va a compartir, esperando como una foto. */}
        {referencia ? (
          <View style={styles.citando}>
            <Ionicons name={ICONO_REFERENCIA[referencia.tipo]} size={20} color={tema.verde700} />
            <View style={styles.crece}>
              <Text style={styles.citandoAutor} numberOfLines={1}>
                {referencia.titulo}
              </Text>
              <Text style={styles.citandoTexto} numberOfLines={1}>
                {referencia.detalle || ETIQUETA_REFERENCIA[referencia.tipo]}
              </Text>
            </View>
            <PressableScale
              onPress={() => setReferencia(null)}
              style={styles.cerrarCita}
              accessibilityLabel="Quitar la ficha"
            >
              <Ionicons name="close" size={18} color={tema.texto3} />
            </PressableScale>
          </View>
        ) : null}

        {pendientes.length > 0 ? (
          <View style={styles.bandeja}>
            {pendientes.map((a, i) => (
              <View key={`${a.uri}-${i}`} style={styles.miniatura}>
                {a.tipo === "video" ? (
                  <View style={[styles.miniaturaFoto, styles.videoCaja]}>
                    <Ionicons name="play" size={22} color="#fff" />
                  </View>
                ) : a.tipo === "documento" ? (
                  <View style={[styles.miniaturaFoto, styles.documentoCaja]}>
                    <Ionicons name="document-text-outline" size={22} color={tema.texto2} />
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
                  // En `estiloExterno`, no en `style`: el `position: absolute`
                  // tiene que ir en el `Pressable` de afuera, que es el hijo de
                  // la miniatura. En la vista de adentro quedaba absoluto
                  // respecto de un `Pressable` en flujo, debajo de la imagen,
                  // y el `overflow: hidden` de la miniatura lo recortaba: la ✕
                  // no se veía ni se tocaba.
                  estiloExterno={styles.quitar}
                  hitSlop={8}
                  accessibilityLabel="Quitar la foto"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </PressableScale>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.escribir}>
          {/* El +: fotos, documento, o una ficha para compartir —una visita,
              un cliente, un producto— como un contacto en WhatsApp. */}
          <PressableScale
            onPress={() => setMenuAdjuntar(true)}
            style={styles.adjuntar}
            accessibilityLabel="Adjuntar"
          >
            <Ionicons name="add" size={28} color={tema.texto2} />
          </PressableScale>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={tema.texto3}
            style={styles.campo}
            multiline
          />
          {/* La cámara al lado del campo, como en WhatsApp: la foto del
              jardín se saca en el momento, y para eso no se abre un menú. */}
          <PressableScale
            onPress={sacarFoto}
            style={styles.adjuntar}
            accessibilityLabel="Tomar una foto o un video"
          >
            <Ionicons name="camera-outline" size={24} color={tema.texto2} />
          </PressableScale>
          <PressableScale
            onPress={() => enviar()}
            // Se puede mandar con texto **o** con fotos esperando: una foto
            // sola es un mensaje, y con pie de foto también.
            disabled={!hayQueMandar}
            style={[styles.enviar, !hayQueMandar && styles.apagado]}
            accessibilityLabel="Enviar"
          >
            <Ionicons name="send" size={18} color="#fff" />
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
              onPress={() => {
                const m = tocado;
                setTocado(null);
                verInfo(m);
              }}
              estiloExterno={styles.ancho}
              style={styles.opcion}
            >
              <Ionicons name="information-circle-outline" size={20} color={tema.texto2} />
              <Text style={styles.opcionTexto}>Info</Text>
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

      <PanelAdjuntar
        visible={menuAdjuntar}
        esOficina={esOficina}
        onCerrar={() => setMenuAdjuntar(false)}
        onElegir={alElegirAdjunto}
      />

      {galeriaAbierta ? (
        <SelectorDeGaleria
          titulo="Fotos y videos"
          conVideos
          // Diez por mensaje, contando lo que ya vino de la cámara o de
          // documentos, que no están en la galería.
          maximo={10 - pendientes.filter((a) => !a.assetId).length}
          preseleccion={pendientes.flatMap((a) => (a.assetId ? [a.assetId] : []))}
          onCerrar={() => setGaleriaAbierta(false)}
          onConfirmar={alConfirmarGaleria}
        />
      ) : null}

      <VistaPreviaDeFicha
        referencia={vistaPrevia}
        onCerrar={() => setVistaPrevia(null)}
        onIrAFicha={(ref) => {
          setVistaPrevia(null);
          // Navegar encima de un Modal que se está cerrando se pierde en iOS.
          setTimeout(() => irAFicha(ref), 150);
        }}
      />

      <CompartirHoja
        tipo={compartiendo}
        onCerrar={() => setCompartiendo(null)}
        onElegir={(ref) => {
          setReferencia(ref);
          setCompartiendo(null);
        }}
      />

      <MediaViewer media={viendo} onClose={() => setViendo(null)} />
    </KeyboardAvoidingView>
  );
}

/**
 * Elegir qué compartir: una visita, un cliente o un producto, con buscador.
 * La lista viene del servidor ya filtrada por quién pregunta —un jardinero
 * ve sus visitas, no todas—, y sin escribir muestra lo cercano: la semana,
 * los primeros clientes, el catálogo. La misma hoja que el diálogo del portal.
 */
function CompartirHoja({
  tipo,
  onCerrar,
  onElegir,
}: {
  tipo: TipoDeReferencia | null;
  onCerrar: () => void;
  onElegir: (ref: ReferenciaEnMensaje) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  /**
   * Lo cargado, con el tipo y la búsqueda a los que pertenece: si no son los
   * de ahora, se está cargando. Sin esto, reabrir el selector para un producto
   * mostraba la lista de visitas de la vez anterior hasta que llegaba la nueva.
   */
  const [datos, setDatos] = useState<{
    tipo: TipoDeReferencia;
    q: string;
    items: ReferenciaEnMensaje[];
  } | null>(null);
  const q = busqueda.trim();
  const items = datos && datos.tipo === tipo && datos.q === q ? datos.items : null;

  useEffect(() => {
    if (!tipo) return;
    let vivo = true;
    const t = setTimeout(() => {
      apiRequest<{ items: ReferenciaEnMensaje[] }>("/api/mobile/chats/compartibles", {
        query: { tipo, q: q || undefined },
      })
        .then((d) => vivo && setDatos({ tipo, q, items: d.items }))
        .catch(() => vivo && setDatos({ tipo, q, items: [] }));
    }, q ? 250 : 0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [tipo, q]);

  const titulo = tipo
    ? `Compartir ${tipo === "visita" ? "una visita" : tipo === "cliente" ? "un cliente" : "un producto"}`
    : "";

  return (
    <HojaInferior
      visible={tipo !== null}
      onCerrar={() => {
        setBusqueda("");
        onCerrar();
      }}
    >
      <View style={styles.compartirCabecera}>
        <Text style={styles.compartirTitulo}>{titulo}</Text>
      </View>
      <View style={styles.compartirBuscador}>
        <Ionicons name="search" size={18} color={tema.texto3} />
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder={tipo === "visita" ? "Cliente o número de visita..." : "Buscar..."}
          placeholderTextColor={tema.texto3}
          style={styles.compartirBuscadorTexto}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={items ?? []}
        keyExtractor={(r) => r.id}
        style={styles.compartirLista}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          items === null ? (
            <ActivityIndicator style={styles.compartirCargando} />
          ) : (
            <Text style={styles.compartirVacio}>Sin coincidencias</Text>
          )
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => onElegir(item)}
            estiloExterno={styles.ancho}
            style={styles.compartirFila}
          >
            <Ionicons name={ICONO_REFERENCIA[item.tipo]} size={20} color={tema.texto2} />
            <View style={styles.crece}>
              <Text style={styles.compartirNombre} numberOfLines={1}>
                {item.titulo}
              </Text>
              <Text style={styles.compartirDetalle} numberOfLines={1}>
                {item.detalle}
              </Text>
            </View>
          </PressableScale>
        )}
      />
    </HojaInferior>
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
  cabeceraTocable: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 8 },
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

  /* Un video no tiene imagen sin reproducirlo: un recuadro oscuro con el
     triángulo es lo que todo el mundo lee como "esto se reproduce". */
  videoCaja: {
    backgroundColor: "rgba(20,40,25,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  documentoCaja: { backgroundColor: tema.lienzo, alignItems: "center", justifyContent: "center" },

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
  escribir: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  adjuntar: {
    width: 34,
    height: 40,
    borderRadius: 17,
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

  compartirCabecera: { alignItems: "center", paddingBottom: 10 },
  compartirTitulo: { fontSize: 16, fontWeight: "700", color: tema.texto },
  compartirBuscador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
  },
  compartirBuscadorTexto: { flex: 1, fontSize: 15, color: tema.texto, padding: 0 },
  compartirLista: { maxHeight: 400, paddingHorizontal: 14 },
  compartirCargando: { padding: 16 },
  compartirVacio: { color: tema.texto3, padding: 14, fontSize: 14 },
  compartirFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea2,
  },
  compartirNombre: { fontSize: 15, fontWeight: "500", color: tema.texto },
  compartirDetalle: { fontSize: 12, color: tema.texto3 },
});
