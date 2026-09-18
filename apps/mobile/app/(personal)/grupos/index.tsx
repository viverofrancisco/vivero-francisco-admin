import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAuthStore } from "@/lib/auth-store";
import type { GrupoConMiembros } from "@/lib/types";
import { tema } from "@/lib/tema";

/** Las cuadrillas: con quién sale cada uno habitualmente. */
export default function GruposListScreen() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.user?.role);
  const puedeEditar = rol === "ADMIN" || rol === "STAFF";
  const [items, setItems] = useState<GrupoConMiembros[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (inicial = false) => {
    if (inicial) setCargando(true);
    else setRefrescando(true);
    try {
      const res = await apiRequest<{ items: GrupoConMiembros[] }>(
        "/api/mobile/grupos"
      );
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos cargar los grupos"));
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar(items.length === 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar])
  );

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <FlatList
        data={items}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar()} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.error}>{error}</Text> : null
        }
        ListEmptyComponent={
          <View style={styles.vacio}>
            <Text variant="titleMedium" style={styles.vacioTitulo}>
              No hay grupos
            </Text>
            <Text variant="bodyMedium" style={styles.vacioTexto}>
              Un grupo junta a quienes salen habitualmente juntos.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => router.push(`/(personal)/grupos/${item.id}`)}
            style={styles.fila}
          >
            <View style={styles.filaTexto}>
              <Text variant="bodyLarge" style={styles.nombre}>
                {item.nombre}
              </Text>
              <Text variant="bodySmall" style={styles.detalle}>
                {item.miembros.length === 0
                  ? "Sin nadie asignado"
                  : item.miembros
                      .map((m) => m.personal.nombre.split(" ")[0])
                      .join(", ")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tema.texto3} />
          </PressableScale>
        )}
      />

      {puedeEditar ? (
        <FAB
          icon="plus"
          style={styles.fab}
          color="#fff"
          onPress={() => router.push("/(personal)/grupos/nuevo")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { padding: 16, paddingBottom: 96 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { color: tema.texto, fontWeight: "500" },
  detalle: { color: tema.texto3 },
  vacio: { alignItems: "center", paddingVertical: 48, gap: 6 },
  vacioTitulo: { color: tema.texto },
  vacioTexto: { color: tema.texto3, textAlign: "center" },
  error: { color: tema.rojo, marginBottom: 12, textAlign: "center" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: tema.verde,
    borderRadius: 16,
  },
});
