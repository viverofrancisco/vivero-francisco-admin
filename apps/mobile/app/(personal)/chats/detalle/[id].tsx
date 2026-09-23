import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { MenuDeEncabezado } from "@/components/ui/MenuDeEncabezado";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { AvatarDeChat } from "@/components/chats/AvatarDeChat";
import type { ChatDetalle, MiembroDeChat } from "@/lib/chats";
import { tema } from "@/lib/tema";

const ROL: Record<string, string> = {
  ADMIN: "Admin",
  STAFF: "Oficina",
  PERSONAL: "Campo",
};

interface Persona {
  id: string;
  nombre: string;
  rol: string;
}

/**
 * La info del chat, como la de un grupo de WhatsApp: se abre tocando el
 * nombre en la conversación. La foto y el nombre arriba, los renglones de
 * *Fotos y videos* y *Enlaces* —la forma rápida de volver a encontrar un
 * archivo sin scrollear meses— y la gente, con *Agregar miembros* y el
 * quitar de cada fila para el ADMIN. El ⋯ del encabezado lleva *Editar
 * nombre y foto*, que es la misma pantalla de crear sin la lista de gente.
 * Es la misma pantalla que el portal.
 */
export default function InfoDelChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [chat, setChat] = useState<ChatDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<MiembroDeChat | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setChat(await apiRequest<ChatDetalle>(`/api/mobile/chats/${id}`));
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos abrir la info"));
    }
  }, [id]);

  // Al volver de editar el nombre o la foto, lo nuevo tiene que estar acá.
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  async function cambiarMiembros(ids: string[]) {
    setOcupado(true);
    try {
      await apiRequest(`/api/mobile/chats/${id}`, {
        method: "PUT",
        body: { miembrosIds: ids },
      });
      await cargar();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos guardar"));
    } finally {
      setOcupado(false);
    }
  }

  const cuantos = chat?.miembros.length ?? 0;

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
        <Text style={styles.tituloCabecera}>Info del chat</Text>
        {chat?.puedeEditar ? (
          <MenuDeEncabezado
            opciones={[
              {
                etiqueta: "Editar nombre y foto",
                onPress: () =>
                  router.push({ pathname: "/(personal)/chats/nuevo", params: { id } }),
              },
            ]}
          />
        ) : (
          <View style={styles.iconoCabecera} />
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!chat ? (
        !error ? (
          <View style={styles.centro}>
            <ActivityIndicator size="large" />
          </View>
        ) : null
      ) : (
        <ScrollView contentContainerStyle={styles.contenido}>
          <View style={styles.presentacion}>
            <AvatarDeChat imagenUrl={chat.imagenUrl} lado={96} />
            <Text style={styles.nombre}>{chat.nombre}</Text>
            <Text style={styles.subtitulo}>
              Grupo · {cuantos} {cuantos === 1 ? "miembro" : "miembros"}
            </Text>
          </View>

          {/* Una sola fila, como en WhatsApp: adentro están las tres pestañas. */}
          <View style={styles.tarjeta}>
            <PressableScale
              onPress={() =>
                router.push({
                  pathname: "/(personal)/chats/medios/[id]",
                  params: { id, tipo: "archivos" },
                })
              }
              estiloExterno={styles.ancho}
              style={styles.fila}
            >
              <Ionicons name="images-outline" size={20} color={tema.texto2} />
              <Text style={styles.filaTexto} numberOfLines={1}>
                Fotos, videos, enlaces y documentos
              </Text>
              <Text style={styles.filaValor}>
                {(chat.medios?.fotosYVideos ?? 0) +
                  (chat.medios?.documentos ?? 0) +
                  (chat.medios?.enlaces ?? 0)}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
            </PressableScale>
          </View>

          <Text style={styles.rotulo}>
            {cuantos} {cuantos === 1 ? "MIEMBRO" : "MIEMBROS"}
          </Text>
          <View style={styles.tarjeta}>
            {chat.puedeEditar ? (
              <PressableScale
                onPress={() => setAgregando(true)}
                estiloExterno={styles.ancho}
                style={styles.fila}
              >
                <View style={styles.mas}>
                  <Ionicons name="add" size={20} color={tema.texto} />
                </View>
                <Text style={styles.filaTexto}>Agregar miembros</Text>
              </PressableScale>
            ) : null}
            {chat.miembros.map((m, i) => (
              <PressableScale
                key={m.id}
                // Tocar a alguien, siendo ADMIN, es para sacarlo: es lo único
                // que se hace con un miembro desde acá.
                onPress={chat.puedeEditar && !m.soyYo ? () => setAQuitar(m) : undefined}
                disabled={!chat.puedeEditar || m.soyYo}
                estiloExterno={styles.ancho}
                style={[styles.fila, (i > 0 || chat.puedeEditar) && styles.filaConLinea]}
              >
                <Avatar nombre={m.nombre} />
                <View style={styles.crece}>
                  <Text style={styles.filaTexto} numberOfLines={1}>
                    {m.soyYo ? "Tú" : m.nombre}
                  </Text>
                  <Text style={styles.filaRol}>{ROL[m.rol] ?? m.rol}</Text>
                </View>
                {chat.puedeEditar && !m.soyYo ? (
                  <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
                ) : null}
              </PressableScale>
            ))}
          </View>
        </ScrollView>
      )}

      <DialogoConfirmar
        visible={aQuitar !== null}
        titulo={`¿Quitar a ${aQuitar?.nombre ?? ""} del chat?`}
        detalle="Deja de ver la conversación. Se lo puede volver a agregar después, con todo lo que se dijo mientras no estaba."
        confirmar="Quitar"
        peligro
        cargando={ocupado}
        onConfirmar={async () => {
          if (!chat || !aQuitar) return;
          await cambiarMiembros(chat.miembros.filter((m) => m.id !== aQuitar.id).map((m) => m.id));
          setAQuitar(null);
        }}
        onCancelar={() => setAQuitar(null)}
      />

      {chat ? (
        <AgregarMiembros
          visible={agregando}
          chat={chat}
          ocupado={ocupado}
          onCerrar={() => setAgregando(false)}
          onAgregar={async (ids) => {
            await cambiarMiembros([...chat.miembros.map((m) => m.id), ...ids]);
            setAgregando(false);
          }}
        />
      ) : null}
    </View>
  );
}

/** Meter gente al chat: los que todavía no están, con casillas y buscador. */
function AgregarMiembros({
  visible,
  chat,
  ocupado,
  onCerrar,
  onAgregar,
}: {
  visible: boolean;
  chat: ChatDetalle;
  ocupado: boolean;
  onCerrar: () => void;
  onAgregar: (ids: string[]) => Promise<void>;
}) {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!visible) return;
    let vivo = true;
    apiRequest<{ items: Persona[] }>("/api/mobile/chats/miembros")
      .then((d) => vivo && setPersonas(d.items))
      .catch(() => vivo && setPersonas([]));
    return () => {
      vivo = false;
    };
  }, [visible]);

  const adentro = new Set(chat.miembros.map((m) => m.id));
  const q = busqueda.trim().toLowerCase();
  const lista = (personas ?? []).filter(
    (p) =>
      !adentro.has(p.id) &&
      (elegidos.includes(p.id) || !q || p.nombre.toLowerCase().includes(q))
  );

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar}>
      <View style={styles.hojaCabecera}>
        <PressableScale onPress={onCerrar} hitSlop={8}>
          <Text style={styles.hojaCancelar}>Cancelar</Text>
        </PressableScale>
        <Text style={styles.hojaTitulo}>Agregar miembros</Text>
        <PressableScale
          onPress={async () => {
            await onAgregar(elegidos);
            setElegidos([]);
            setBusqueda("");
          }}
          disabled={ocupado || elegidos.length === 0}
          style={[styles.hojaAccion, (ocupado || elegidos.length === 0) && styles.apagado]}
        >
          <Text style={styles.hojaAccionTexto}>{ocupado ? "Agregando…" : "Agregar"}</Text>
        </PressableScale>
      </View>
      <View style={styles.buscador}>
        <Ionicons name="search" size={18} color={tema.texto3} />
        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar persona..."
          placeholderTextColor={tema.texto3}
          style={styles.buscadorTexto}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <ScrollView style={styles.hojaLista}>
        {personas === null ? (
          <ActivityIndicator style={styles.hojaCargando} />
        ) : lista.length === 0 ? (
          <Text style={styles.sinCoincidencias}>
            {q ? "Sin coincidencias" : "Ya están todos adentro."}
          </Text>
        ) : (
          lista.map((p) => {
            const marcado = elegidos.includes(p.id);
            return (
              <PressableScale
                key={p.id}
                onPress={() =>
                  setElegidos((a) => (marcado ? a.filter((x) => x !== p.id) : [...a, p.id]))
                }
                estiloExterno={styles.ancho}
                style={[styles.fila, styles.filaConLinea, marcado && styles.filaMarcada]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcado }}
              >
                <Ionicons
                  name={marcado ? "checkbox" : "square-outline"}
                  size={22}
                  color={marcado ? tema.verde : tema.texto3}
                />
                <Text style={styles.filaTexto} numberOfLines={1}>
                  {p.nombre}
                </Text>
                <Text style={styles.filaRol}>{ROL[p.rol] ?? p.rol}</Text>
              </PressableScale>
            );
          })
        )}
      </ScrollView>
    </HojaInferior>
  );
}

function Avatar({ nombre }: { nombre: string }) {
  const iniciales =
    nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarTexto}>{iniciales}</Text>
    </View>
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
  tituloCabecera: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
  contenido: { padding: 12, paddingBottom: 32, gap: 14 },
  presentacion: { alignItems: "center", gap: 4, paddingTop: 8 },
  nombre: { fontSize: 20, fontWeight: "700", color: tema.texto, textAlign: "center", paddingTop: 4 },
  subtitulo: { fontSize: 14, color: tema.texto3 },
  rotulo: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: tema.texto3,
    paddingHorizontal: 4,
    marginBottom: -8,
  },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tema.linea,
    overflow: "hidden",
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filaConLinea: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tema.linea },
  filaMarcada: { backgroundColor: tema.verde50 },
  filaTexto: { flex: 1, fontSize: 15, fontWeight: "500", color: tema.texto },
  filaValor: { fontSize: 14, color: tema.texto3 },
  filaRol: { fontSize: 12, color: tema.texto3 },
  mas: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tema.lienzo,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: tema.verde700, fontWeight: "700", fontSize: 13 },
  hojaCabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  hojaCancelar: { color: tema.texto2, fontSize: 15, fontWeight: "600" },
  hojaTitulo: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: tema.texto },
  hojaAccion: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.verde,
  },
  hojaAccionTexto: { color: "#fff", fontSize: 13, fontWeight: "600" },
  apagado: { opacity: 0.4 },
  buscador: {
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
  buscadorTexto: { flex: 1, fontSize: 15, color: tema.texto, padding: 0 },
  hojaLista: { maxHeight: 380, paddingHorizontal: 14 },
  hojaCargando: { padding: 16 },
  sinCoincidencias: { color: tema.texto3, padding: 14, fontSize: 14 },
});
