import { useEffect, useState } from "react";
import { ETIQUETA_DE_ROL } from "@vivero/shared";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  FlipType,
  SaveFormat,
  manipulateAsync,
  type Action,
} from "expo-image-manipulator";
import { RecortarFoto, type EdicionDeFoto } from "@/components/informes/RecortarFoto";

import { apiRequest, mensajeDeError } from "@/lib/api";
import { AvatarDeChat } from "@/components/chats/AvatarDeChat";
import { PressableScale } from "@/components/ui/PressableScale";
import { Campo, Titulo } from "@/components/ui/Formulario";
import type { ChatDetalle } from "@/lib/chats";
import { tema } from "@/lib/tema";

/** Lo que se sube: la foto ya recortada, o la que vino de la galería. */
interface FotoLista {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

interface Persona {
  id: string;
  nombre: string;
  rol: string;
}

const ROL: Record<string, string> = ETIQUETA_DE_ROL;

/**
 * Armar un chat o cambiarle la gente. **Solo el ADMIN llega acá** — el servicio
 * lo rechaza igual, pero la pantalla no ofrece lo que después va a negar.
 *
 * La misma pantalla crea y edita: con `?id=` trae lo que hay y guarda encima.
 * Son los mismos dos campos, y dos pantallas iguales son dos lugares donde
 * arreglar lo mismo.
 */
export default function ChatFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const editando = Boolean(id);

  const [nombre, setNombre] = useState("");
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** La foto que ya tiene, la elegida y todavía no subida, y si se quita. */
  const [imagenActual, setImagenActual] = useState<string | null>(null);
  const [foto, setFoto] = useState<FotoLista | null>(null);
  const [quitar, setQuitar] = useState(false);
  /** La elegida en la galería, mientras se recorta. */
  const [recortando, setRecortando] = useState<string | null>(null);
  const vistaDeFoto = foto?.uri ?? (quitar ? null : imagenActual);

  /**
   * La foto del grupo, como en WhatsApp: se elige en la galería y se recorta
   * en **nuestro** recortador con el círculo dibujado, que es lo que se va a
   * ver. Pasaba por el recorte del sistema (`allowsEditing` 1:1), que
   * muestra un cuadrado para una foto que después sale redonda.
   */
  async function elegirFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (r.canceled) return;
    setRecortando(r.assets[0].uri);
  }

  /**
   * El recorte se aplica acá, en el teléfono: la foto del chat no es un
   * medio de la biblioteca con id al que el servidor le sepa recortar. El
   * orden es el del recortador —espejo, giro, recorte— y sale JPEG chico,
   * que son varios MB para un círculo de 40 px.
   */
  async function aplicarRecorte(edicion: EdicionDeFoto) {
    if (!recortando) return;
    const acciones: Action[] = [];
    if (edicion.voltear) acciones.push({ flip: FlipType.Horizontal });
    if (edicion.rotar) acciones.push({ rotate: edicion.rotar });
    acciones.push({
      crop: {
        originX: edicion.recorte.x,
        originY: edicion.recorte.y,
        width: edicion.recorte.ancho,
        height: edicion.recorte.alto,
      },
    });
    try {
      const res = await manipulateAsync(recortando, acciones, {
        compress: 0.7,
        format: SaveFormat.JPEG,
      });
      setFoto({ uri: res.uri, mimeType: "image/jpeg", fileName: "grupo.jpg" });
      setQuitar(false);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos recortar la foto"));
    } finally {
      setRecortando(null);
    }
  }

  /** Sube la foto bajo el prefijo del chat y la deja como su imagen. */
  async function subirFoto(chatId: string, asset: FotoLista) {
    const contentType = asset.mimeType ?? "image/jpeg";
    const { uploads } = await apiRequest<{
      uploads: { key: string; url: string; uploadUrl: string }[];
    }>(`/api/mobile/chats/${chatId}/fotos`, {
      method: "POST",
      body: { files: [{ fileName: asset.fileName ?? "grupo.jpg", contentType }] },
    });
    const blob = await (await fetch(asset.uri)).blob();
    const res = await fetch(uploads[0].uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!res.ok) throw new Error("No pudimos subir la foto");
    await apiRequest(`/api/mobile/chats/${chatId}`, {
      method: "PUT",
      body: { imagen: { key: uploads[0].key, url: uploads[0].url } },
    });
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [lista, chat] = await Promise.all([
          apiRequest<{ items: Persona[] }>("/api/mobile/chats/miembros"),
          id
            ? apiRequest<ChatDetalle>(`/api/mobile/chats/${id}`)
            : Promise.resolve(null),
        ]);
        if (!vivo) return;
        setPersonas(lista.items);
        if (chat) {
          setNombre(chat.nombre);
          setElegidos(chat.miembros.map((m) => m.id));
          setImagenActual(chat.imagenUrl ?? null);
        }
      } catch (e) {
        if (vivo) setError(mensajeDeError(e, "No pudimos cargar"));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  async function guardar() {
    if (!nombre.trim()) {
      setError("Ponle un nombre");
      return;
    }
    setGuardando(true);
    try {
      const body = { nombre: nombre.trim(), miembrosIds: elegidos };
      // La foto va después, con el chat ya creado: la firma de subida es por
      // chat, así que antes no hay dónde ponerla.
      if (editando) {
        // Solo el nombre: la gente se cambia desde la info del chat.
        await apiRequest(`/api/mobile/chats/${id}`, {
          method: "PUT",
          body: { nombre: nombre.trim() },
        });
        if (foto) await subirFoto(id!, foto);
        else if (quitar && imagenActual) {
          await apiRequest(`/api/mobile/chats/${id}`, { method: "PUT", body: { imagen: null } });
        }
        router.back();
      } else {
        const chat = await apiRequest<{ id: string }>("/api/mobile/chats", {
          method: "POST",
          body,
        });
        if (foto) await subirFoto(chat.id, foto);
        // Con `pathname` y `params`, no con la ruta armada a mano: expo-router
        // resuelve el segmento dinámico él mismo. Interpolada quedaba sin
        // resolver y caía en "Unmatched Route" con el chat ya creado.
        router.replace({
          pathname: "/(personal)/chats/[id]",
          params: { id: chat.id },
        });
      }
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setGuardando(false);
    }
  }

  /*
   * Los marcados quedan **arriba y siempre a la vista**, incluso mientras se
   * busca: si no, elegir a la cuarta persona esconde a las tres anteriores y
   * hay que borrar la búsqueda para saber a quiénes ya elegiste.
   */
  const q = busqueda.trim().toLowerCase();
  const lista = (personas ?? []).filter(
    (p) => elegidos.includes(p.id) || !q || p.nombre.toLowerCase().includes(q)
  );

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      {/* Encabezado propio, sin el nativo: el de la pila decía "‹ index" y
          repetía el título. Cancelar a la izquierda y la acción a la derecha,
          que es donde el pulgar espera cada una y donde están siempre a la
          vista —un formulario largo no puede tener el botón a seis gestos de
          lo último que se escribió—. */}
      <View style={[styles.cabecera, { paddingTop: insets.top + 8 }]}>
        <PressableScale onPress={() => router.back()} style={styles.cancelar}>
          <Text style={styles.cancelarTexto}>Cancelar</Text>
        </PressableScale>
        <Text style={styles.titulo}>{editando ? "Editar chat" : "Nuevo chat"}</Text>
        <PressableScale
          onPress={guardar}
          disabled={guardando || !nombre.trim()}
          style={[
            styles.accion,
            (guardando || !nombre.trim()) && styles.apagado,
          ]}
        >
          <Text style={styles.accionTexto}>
            {guardando ? "Guardando…" : editando ? "Guardar" : "Crear"}
          </Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.cuerpo}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* La foto del grupo: el círculo se toca para elegirla, y debajo se
            puede quitar. Igual que en el portal. */}
        <View style={styles.fotoBloque}>
          <PressableScale
            onPress={elegirFoto}
            accessibilityLabel={vistaDeFoto ? "Cambiar la foto del grupo" : "Poner una foto al grupo"}
          >
            <View>
              <AvatarDeChat imagenUrl={vistaDeFoto} lado={80} />
              <View style={styles.camara}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </View>
          </PressableScale>
          {vistaDeFoto ? (
            <PressableScale
              onPress={() => {
                setFoto(null);
                setQuitar(true);
              }}
              hitSlop={8}
            >
              <Text style={styles.quitarFoto}>Quitar foto</Text>
            </PressableScale>
          ) : null}
        </View>

        <Campo
          label="Nombre"
          required
          value={nombre}
          onChangeText={setNombre}
          placeholder="Cuadrilla 1, Administración, Urgencias..."
        />

        {/* Al editar, solo el nombre y la foto, como el "Editar grupo" de
            WhatsApp: la gente se agrega y se quita desde la info del chat. */}
        {editando ? null : (
        <>
        <Titulo>Miembros</Titulo>
        {personas === null || personas.length === 0 ? (
          <Text style={styles.vacio}>
            No hay cuentas que puedan entrar a un chat.
          </Text>
        ) : (
          <>
          <View style={[styles.buscador, styles.separado]}>
            <Ionicons name="search" size={18} color={tema.texto3} />
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar persona..."
              placeholderTextColor={tema.texto3}
              style={styles.buscadorTexto}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
          <View style={styles.lista}>
            {lista.length === 0 ? (
              <Text style={styles.sinCoincidencias}>Sin coincidencias</Text>
            ) : null}
            {lista.map((p) => {
              const marcado = elegidos.includes(p.id);
              return (
                <PressableScale
                  key={p.id}
                  onPress={() =>
                    setElegidos((actuales) =>
                      marcado
                        ? actuales.filter((x) => x !== p.id)
                        : [...actuales, p.id]
                    )
                  }
                  estiloExterno={styles.ancho}
                  style={[styles.fila, marcado && styles.filaMarcada]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                >
                  <Ionicons
                    name={marcado ? "checkbox" : "square-outline"}
                    size={22}
                    color={marcado ? tema.verde : tema.texto3}
                  />
                  <Text style={styles.nombre} numberOfLines={1}>
                    {p.nombre}
                  </Text>
                  <Text style={styles.rol}>{ROL[p.rol] ?? p.rol}</Text>
                </PressableScale>
              );
            })}
          </View>
          </>
        )}
        </>
        )}
      </ScrollView>

      {recortando ? (
        <RecortarFoto
          circulo
          url={recortando}
          onCerrar={() => setRecortando(null)}
          onGuardar={(edicion) => void aplicarRecorte(edicion)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  fotoBloque: { alignItems: "center", gap: 6, paddingTop: 4, paddingBottom: 12 },
  camara: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: tema.superficie,
    backgroundColor: tema.verde,
    alignItems: "center",
    justifyContent: "center",
  },
  quitarFoto: { fontSize: 12, fontWeight: "600", color: tema.texto3 },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: tema.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.linea,
  },
  titulo: { flex: 1, fontSize: 17, fontWeight: "700", color: tema.texto, textAlign: "center" },
  cancelar: { paddingVertical: 6, paddingRight: 8 },
  cancelarTexto: { color: tema.texto2, fontSize: 15, fontWeight: "600" },
  accion: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.verde,
  },
  accionTexto: { color: "#fff", fontSize: 13, fontWeight: "600" },
  apagado: { opacity: 0.4 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Sin `gap`: `Campo` y `Titulo` ya traen su propio margen, y sumarlos dejaba
  // cuarenta píxeles de blanco entre el nombre y la lista.
  cuerpo: { padding: 16, paddingBottom: 32 },
  ancho: { alignSelf: "stretch" },
  buscador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
  },
  buscadorTexto: { flex: 1, fontSize: 15, color: tema.texto, padding: 0 },
  // Aire entre el buscador y la lista: pegados se leen como un solo bloque y
  // la primera fila parece parte del campo.
  separado: { marginBottom: 8 },
  sinCoincidencias: { color: tema.texto3, padding: 14, fontSize: 14 },
  lista: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    backgroundColor: tema.superficie,
    overflow: "hidden",
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.linea2,
  },
  filaMarcada: { backgroundColor: tema.verde50 },
  nombre: { flex: 1, fontSize: 15, fontWeight: "500", color: tema.texto },
  rol: { fontSize: 12, color: tema.texto3 },
  vacio: { color: tema.texto3 },
  error: { color: tema.rojo },
});
