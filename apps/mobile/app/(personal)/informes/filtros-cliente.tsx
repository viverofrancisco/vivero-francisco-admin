import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Searchbar, Text } from "react-native-paper";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { nombreCliente } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { useInformesFilters } from "@/lib/informes-filters-store";

interface ClienteOption {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  sector?: { nombre: string | null } | null;
}

export default function FiltrosClienteScreen() {
  const router = useRouter();
  const { cliente, setCliente } = useInformesFilters();
  const [items, setItems] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiRequest<{ items: ClienteOption[] }>(
          "/api/mobile/clientes",
          { query: { limit: 200 } }
        );
        setItems(res.items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    const words = q.split(/\s+/).filter(Boolean);
    return items.filter((c) => {
      const hay = `${nombreCliente(c)} ${c.telefono ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, search]);

  function pick(c: ClienteOption | null) {
    if (c) {
      setCliente({
        id: c.id,
        nombre: nombreCliente(c),
      });
    } else {
      setCliente(null);
    }
    router.back();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Cliente" }} />
      <View style={styles.container}>
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <Searchbar
                placeholder="Buscar por nombre o teléfono"
                value={search}
                onChangeText={setSearch}
                elevation={0}
                style={styles.search}
                inputStyle={styles.searchInput}
                autoFocus
              />
              <Pressable
                onPress={() => pick(null)}
                style={({ pressed }) => [
                  styles.row,
                  cliente === null && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={[styles.avatar, styles.avatarAll]}>
                  <Ionicons name="people" size={18} color="#666" />
                </View>
                <View style={styles.rowText}>
                  <Text variant="bodyLarge" style={styles.rowTitle}>
                    Todos los clientes
                  </Text>
                </View>
                {cliente === null ? (
                  <Ionicons name="checkmark" size={20} color="#2e7d32" />
                ) : null}
              </Pressable>
              <View style={styles.sep} />
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                {search ? "Sin coincidencias" : "No hay clientes"}
              </Text>
              <Text variant="bodyMedium" style={styles.emptyBody}>
                {search
                  ? "Prueba con otro nombre o teléfono."
                  : "Aún no hay clientes registrados."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const selected = cliente?.id === item.id;
            const displayName = nombreCliente(item);
            const initials =
              displayName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase() || "?";
            const subtitle = [item.telefono, item.sector?.nombre, item.ciudad]
              .filter(Boolean)
              .join(" · ");
            return (
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  pressed && !selected && styles.rowPressed,
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials || "?"}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {subtitle ? (
                    <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                {selected ? (
                  <Ionicons name="checkmark" size={20} color="#2e7d32" />
                ) : null}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 24 },

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
  rowSelected: { backgroundColor: "#e8f5e9" },
  rowPressed: { backgroundColor: "#eaeaea" },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: "#111", fontWeight: "500" },
  muted: { color: "#888" },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarAll: { backgroundColor: "#f0f0f0" },
  avatarText: { color: "#2e7d32", fontWeight: "600", fontSize: 14 },

  sep: { height: 6 },

  empty: { paddingVertical: 80, alignItems: "center", gap: 8 },
  emptyTitle: { color: "#444" },
  emptyBody: { color: "#888", textAlign: "center", paddingHorizontal: 24 },
});
