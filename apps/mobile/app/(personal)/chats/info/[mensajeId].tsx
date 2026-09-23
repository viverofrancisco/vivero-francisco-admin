import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { Burbuja } from "@/components/chats/Burbuja";
import { cuandoLeyo, tituloDelDia, type InfoDeMensaje } from "@/lib/chats";
import { tema } from "@/lib/tema";

/**
 * Quién leyó un mensaje propio, y cuándo. La pantalla de WhatsApp: el mensaje
 * arriba, tal cual se ve en la conversación, y debajo quiénes lo leyeron —el
 * más reciente primero— y a quiénes les falta. Se llega corriendo el mensaje
 * a la izquierda, o desde su menú.
 */
export default function InfoDeMensajeScreen() {
  const { mensajeId } = useLocalSearchParams<{ mensajeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<InfoDeMensaje | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    apiRequest<InfoDeMensaje>(`/api/mobile/chats/mensajes/${mensajeId}/info`)
      .then((d) => vivo && setInfo(d))
      .catch((e) => vivo && setError(mensajeDeError(e, "No pudimos traer la info")));
    return () => {
      vivo = false;
    };
  }, [mensajeId]);

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
        <Text style={styles.titulo}>Info del mensaje</Text>
        <View style={styles.iconoCabecera} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!info && !error ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}

      {info ? (
        <ScrollView contentContainerStyle={styles.contenido}>
          <View style={styles.escenario}>
            <View style={styles.dia}>
              <Text style={styles.diaTexto}>{tituloDelDia(info.mensaje.createdAt)}</Text>
            </View>
            <View style={styles.aLaDerecha}>
              <Burbuja mensaje={info.mensaje} conNombre={false} soloLectura />
            </View>
          </View>

          <View style={styles.seccion}>
            <View style={styles.seccionTitulo}>
              <Ionicons name="checkmark-done" size={16} color="#0ea5e9" />
              <Text style={styles.seccionTexto}>Leído por</Text>
            </View>
            {info.leidoPor.length === 0 ? (
              <Text style={styles.nadie}>Todavía nadie.</Text>
            ) : (
              <View style={styles.lista}>
                {info.leidoPor.map((p, i) => (
                  <View key={p.id} style={[styles.fila, i > 0 && styles.filaSeparada]}>
                    <Avatar nombre={p.nombre} />
                    <Text style={styles.nombre} numberOfLines={1}>
                      {p.nombre}
                    </Text>
                    <Text style={styles.cuando}>{cuandoLeyo(p.leidoEl)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {info.sinLeer.length > 0 ? (
            <View style={styles.seccion}>
              <View style={styles.seccionTitulo}>
                <Ionicons name="checkmark-done" size={16} color={tema.texto3} />
                <Text style={styles.seccionTexto}>Sin leer</Text>
              </View>
              <View style={styles.lista}>
                {info.sinLeer.map((p, i) => (
                  <View key={p.id} style={[styles.fila, i > 0 && styles.filaSeparada]}>
                    <Avatar nombre={p.nombre} />
                    <Text style={styles.nombre} numberOfLines={1}>
                      {p.nombre}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
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
  titulo: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: tema.texto },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
  contenido: { padding: 12, gap: 16 },
  /* El mensaje, sobre el mismo fondo que en la conversación. */
  escenario: {
    backgroundColor: tema.lienzo,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  dia: { alignItems: "center", paddingBottom: 10 },
  diaTexto: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.texto3,
    backgroundColor: tema.superficie,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  aLaDerecha: { alignSelf: "flex-end", maxWidth: "85%" },
  seccion: { gap: 6 },
  seccionTitulo: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  seccionTexto: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: tema.texto3,
  },
  nadie: { paddingHorizontal: 4, fontSize: 14, color: tema.texto3 },
  lista: {
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
  filaSeparada: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tema.linea },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tema.verde50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: tema.verde700, fontWeight: "700", fontSize: 13 },
  nombre: { flex: 1, fontSize: 15, fontWeight: "600", color: tema.texto },
  cuando: { fontSize: 12, color: tema.texto3 },
});
