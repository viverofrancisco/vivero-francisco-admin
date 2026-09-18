import { useCallback, useEffect, useMemo, useState } from "react";
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
import { nombreCliente, resumenDeCliente } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { Pastillas } from "@/components/ui/Pastillas";
import { useAuthStore } from "@/lib/auth-store";
import type { ClienteListItem, ClientesListResponse } from "@/lib/types";
import { tema } from "@/lib/tema";

export default function ClientesListScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = role === "ADMIN" || role === "STAFF";
  const [items, setItems] = useState<ClienteListItem[]>([]);
  const [search, setSearch] = useState("");
  /**
   * El filtro por sector, el mismo que el portal. Las opciones salen de los
   * clientes que ya llegaron —no de la tabla de sectores— así que no aparece un
   * sector en el que nadie tiene una propiedad, que sería un filtro que
   * siempre da vacío.
   */
  const [sector, setSector] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (q: string, initial = false) => {
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await apiRequest<ClientesListResponse>(
          "/api/mobile/clientes",
          { query: { search: q || undefined, limit: 100 } }
        );
        setItems(res.items);
      } catch {
        // ignore
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    load("", true);
  }, [load]);

  // Debounce search
  useEffect(() => {
    const handle = setTimeout(() => load(search), 300);
    return () => clearTimeout(handle);
  }, [search, load]);

  const sectores = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const c of items) {
      const s = c.propiedades[0]?.sector;
      if (s && !vistos.has(s.nombre)) vistos.set(s.nombre, s.nombre);
    }
    return [
      { clave: "", etiqueta: "Todos" },
      ...[...vistos.keys()].sort().map((n) => ({ clave: n, etiqueta: n })),
    ];
  }, [items]);

  const visibles = useMemo(
    () =>
      sector
        ? items.filter((c) => c.propiedades[0]?.sector?.nombre === sector)
        : items,
    [items, sector]
  );

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
        data={visibles}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(search)}
          />
        }
        ListHeaderComponent={
          <View style={styles.cabecera}>
            <Searchbar
              placeholder="Buscar por nombre o teléfono"
              value={search}
              onChangeText={setSearch}
              elevation={0}
              style={styles.search}
              inputStyle={styles.searchInput}
            />
            {/* Solo con más de un sector: con uno, el filtro no filtra nada. */}
            {sectores.length > 2 ? (
              <Pastillas opciones={sectores} valor={sector} onElegir={setSector} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              {search ? "Sin coincidencias" : "No hay clientes"}
            </Text>
            <Text variant="bodyMedium" style={styles.emptyBody}>
              {search
                ? "Prueba con otro nombre o teléfono."
                : canCreate
                  ? "Toca el botón + para crear uno."
                  : "Aún no hay clientes registrados."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ClienteRow
            cliente={item}
            onPress={() => router.push(`/(personal)/clientes/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
      {canCreate ? (
        <FAB
          icon="plus"
          color="#fff"
          style={styles.fab}
          onPress={() => router.push("/(personal)/clientes/nuevo")}
        />
      ) : null}
    </View>
  );
}

function ClienteRow({
  cliente: c,
  onPress,
}: {
  cliente: ClienteListItem;
  onPress: () => void;
}) {
  const displayName = nombreCliente(c);
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  // La misma línea que la fila del portal: la empresa cuando arriba va el
  // nombre de la persona, después el sector y el teléfono.
  const subtitle = resumenDeCliente(c);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 96 },

  cabecera: { gap: 8, marginBottom: 12 },
  search: {
    backgroundColor: "#f4f4f4",
    borderRadius: 12,
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
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: tema.verde,
    fontWeight: "600",
    fontSize: 14,
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
    backgroundColor: tema.verde,
  },
});
