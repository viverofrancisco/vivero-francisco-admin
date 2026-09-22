import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { useAuthStore } from "@/lib/auth-store";
import { cuandoFue, resumenDelUltimo, type ChatEnLista } from "@/lib/chats";
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

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: ChatEnLista[] }>("/api/mobile/chats");
      setItems(res.items);
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
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? items.filter((c) => c.nombre.toLowerCase().includes(q))
    : items;

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
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : null
          }
          ListEmptyComponent={
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
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push(`/(personal)/chats/${item.id}`)}
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
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, textAlign: "center", padding: 16 },
});
