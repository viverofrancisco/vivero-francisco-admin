import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, FAB, IconButton, Text } from "react-native-paper";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest } from "@/lib/api";
import { useInformesFilters } from "@/lib/informes-filters-store";

interface InformeItem {
  id: string;
  titulo: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  pdfUrl: string;
  generatedAt: string;
  cliente: { id: string; nombre: string };
  visitasCount: number;
}

const PAGE_SIZE = 20;

export default function InformesListScreen() {
  const router = useRouter();
  const { cliente, from, to, activeCount } = useInformesFilters();
  const activeFilters = activeCount();

  const [items, setItems] = useState<InformeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (opts: { initial?: boolean; refresh?: boolean } = {}) => {
      const { initial = false, refresh = false } = opts;
      if (initial) setLoading(true);
      else if (refresh) setRefreshing(true);
      try {
        const res = await apiRequest<{
          items: InformeItem[];
          total: number;
        }>("/api/mobile/informes", {
          query: {
            limit: PAGE_SIZE,
            offset: 0,
            ...(cliente ? { clienteId: cliente.id } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          },
        });
        setItems(res.items);
        setTotal(res.total);
      } catch {
        // ignore
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cliente, from, to]
  );

  // Re-fetch whenever filters change (and on initial mount).
  useEffect(() => {
    load({ initial: true });
  }, [load]);

  // Also refresh when returning to this screen (e.g. after filter changes via store).
  useFocusEffect(
    useCallback(() => {
      load({ refresh: false });
    }, [load])
  );

  async function loadMore() {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const res = await apiRequest<{
        items: InformeItem[];
        total: number;
      }>("/api/mobile/informes", {
        query: {
          limit: PAGE_SIZE,
          offset: items.length,
          ...(cliente ? { clienteId: cliente.id } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      });
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Informes",
          headerRight: () => (
            <View style={styles.headerRight}>
              <IconButton
                icon="filter-variant"
                size={22}
                onPress={() => router.push("/(personal)/informes/filtros")}
              />
              {activeFilters > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{activeFilters}</Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <View style={styles.container}>
          {activeFilters > 0 ? (
            <Pressable
              onPress={() => router.push("/(personal)/informes/filtros")}
              style={styles.summaryStrip}
            >
              <Ionicons name="funnel" size={14} color="#2e7d32" />
              <Text style={styles.summaryText} numberOfLines={1}>
                {summarize(cliente?.nombre, from, to)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#2e7d32" />
            </Pressable>
          ) : null}

          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load({ refresh: true })}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text variant="titleMedium" style={styles.emptyTitle}>
                  No hay informes
                </Text>
                <Text variant="bodyMedium" style={styles.emptyBody}>
                  {activeFilters > 0
                    ? "Sin coincidencias para los filtros aplicados."
                    : "Aún no se ha generado ningún informe. Usa el panel web para crear uno."}
                </Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footer}>
                  <ActivityIndicator />
                </View>
              ) : null
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => (
              <InformeRow
                item={item}
                onPress={() =>
                  router.push(`/(personal)/informes/${item.id}`)
                }
              />
            )}
          />
          <FAB
            icon="plus"
            color="#fff"
            style={styles.fab}
            onPress={() => router.push("/(personal)/informes/nuevo")}
          />
        </View>
      )}
    </>
  );
}

function InformeRow({
  item,
  onPress,
}: {
  item: InformeItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name="document-text-outline" size={20} color="#2e7d32" />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={2}>
          {item.titulo}
        </Text>
        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
          {item.cliente.nombre}
        </Text>
        <Text variant="bodySmall" style={styles.metaLine}>
          {formatGeneratedAt(item.generatedAt)} · {item.visitasCount} visita
          {item.visitasCount === 1 ? "" : "s"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
    </Pressable>
  );
}

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatChipDate(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

function summarize(
  clienteName: string | undefined,
  from: string | null,
  to: string | null
): string {
  const parts: string[] = [];
  if (clienteName) parts.push(clienteName);
  if (from || to) {
    if (from && to) parts.push(`${formatChipDate(from)} → ${formatChipDate(to)}`);
    else if (from) parts.push(`Desde ${formatChipDate(from)}`);
    else if (to) parts.push(`Hasta ${formatChipDate(to)}`);
  }
  return parts.join(" · ");
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#2e7d32",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#eef5ef",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cfe5d2",
  },
  summaryText: { flex: 1, color: "#2e7d32", fontSize: 13, fontWeight: "500" },
  listContent: { paddingVertical: 8 },
  empty: { padding: 32, alignItems: "center" },
  emptyTitle: { marginBottom: 4 },
  emptyBody: { color: "#666", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 8,
    gap: 12,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e8f5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontWeight: "500" },
  muted: { color: "#555", marginTop: 2 },
  metaLine: { color: "#888", marginTop: 2, fontSize: 11 },
  footer: { paddingVertical: 16, alignItems: "center" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#2e7d32",
    zIndex: 10,
  },
});
