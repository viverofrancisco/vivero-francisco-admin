import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  FAB,
  Searchbar,
  Text,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { apiRequest } from "@/lib/api";
import type { ServicioListItem, ServiciosListResponse } from "@/lib/types";

export default function ServiciosListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ServicioListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (q: string, initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiRequest<ServiciosListResponse>(
        "/api/mobile/servicios",
        { query: { search: q || undefined, limit: 100 } }
      );
      setItems(res.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load("", true);
  }, [load]);

  useEffect(() => {
    const handle = setTimeout(() => load(search), 300);
    return () => clearTimeout(handle);
  }, [search, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(search)}
          />
        }
        ListHeaderComponent={
          <Searchbar
            placeholder="Buscar servicios"
            value={search}
            onChangeText={setSearch}
            elevation={0}
            style={styles.search}
            inputStyle={styles.searchInput}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              {search ? "Sin coincidencias" : "No hay servicios"}
            </Text>
            <Text variant="bodyMedium" style={styles.emptyBody}>
              {search
                ? "Prueba con otro nombre."
                : "Toca el botón + para crear uno."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ServicioRow
            servicio={item}
            onPress={() => router.push(`/(personal)/servicios/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
      <FAB
        icon="plus"
        color="#fff"
        style={styles.fab}
        onPress={() => router.push("/(personal)/servicios/nuevo")}
      />
    </View>
  );
}

function ServicioRow({
  servicio: s,
  onPress,
}: {
  servicio: ServicioListItem;
  onPress: () => void;
}) {
  const initial = (s.nombre[0] ?? "?").toUpperCase();
  // No hay productos recurrentes en el catálogo: lo que se marca es si
  // alguien lo tiene hoy en un plan.
  const enPlanes = s._count.suscripcionItems > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View
        style={[
          styles.avatar,
          enPlanes ? styles.avatarRecurrente : styles.avatarUnico,
        ]}
      >
        <Text
          style={[
            styles.avatarText,
            enPlanes
              ? styles.avatarTextRecurrente
              : styles.avatarTextUnico,
          ]}
        >
          {initial}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
          {s.nombre}
        </Text>
        {s.descripcion ? (
          <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
            {s.descripcion}
          </Text>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text variant="bodySmall" style={styles.metaPrimary}>
          {enPlanes
            ? `${s._count.suscripcionItems} en plan`
            : "Sin planes"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 96 },

  search: {
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
    marginBottom: 12,
  },
  searchInput: { fontSize: 15 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    gap: 12,
  },
  rowPressed: { backgroundColor: "#eaeaea" },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: "#111", fontWeight: "500" },
  muted: { color: "#888" },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRecurrente: { backgroundColor: "#e8f5e9" },
  avatarUnico: { backgroundColor: "#f0f0f0" },
  avatarText: { fontWeight: "600", fontSize: 14 },
  avatarTextRecurrente: { color: "#2e7d32" },
  avatarTextUnico: { color: "#555" },

  meta: {
    alignItems: "flex-end",
    gap: 2,
  },
  metaPrimary: {
    color: "#111",
    fontWeight: "500",
  },
  metaSecondary: {
    color: "#888",
  },

  sep: { height: 6 },

  empty: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: "#444" },
  emptyBody: { color: "#888", textAlign: "center", paddingHorizontal: 24 },

  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#2e7d32",
  },
});
