import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fechaSola, nombreCliente, resumenDePropiedades } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { FILA_LISTA, PantallaLista } from "@/components/ui/PantallaLista";
import { useInformesFilters } from "@/lib/informes-filters-store";
import { tema } from "@/lib/tema";

interface InformeItem {
  id: string;
  /** Como se lo nombra en voz alta. */
  numero: number;
  /** En qué versión va. Mayor a 1 = se corrigió. */
  version: number;
  titulo: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  pdfUrl: string;
  generatedAt: string;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa: string | null;
  };
  visitasCount: number;
  /** En qué propiedades pasó lo que cuenta. Vacío si no cubre visitas. */
  propiedades: string[];
}

const PAGE_SIZE = 20;

export default function InformesListScreen() {
  const router = useRouter();
  const { from, to, activeCount } = useInformesFilters();
  const activeFilters = activeCount();
  /**
   * El buscador del portal: nombre del cliente, título o número con o sin `#`.
   * Viaja al servidor —la lista viene de a páginas, así que filtrar acá sería
   * buscar adentro de lo que ya se ve.
   */
  const [busqueda, setBusqueda] = useState("");

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
            ...(busqueda.trim() ? { q: busqueda.trim() } : {}),
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
    [busqueda, from, to]
  );

  /*
   * Se vuelve a pedir cuando cambian los filtros o la búsqueda, con ~300 ms de
   * respiro: una consulta por tecla es ruido y las respuestas llegan
   * desordenadas.
   */
  useEffect(() => {
    const reloj = setTimeout(() => load({ initial: items.length === 0 }), 300);
    return () => clearTimeout(reloj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          ...(busqueda.trim() ? { q: busqueda.trim() } : {}),
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
    <PantallaLista
      titulo="Informes"
      acciones={[
        {
          etiqueta: "Generar informe",
          onPress: () => router.push("/(personal)/informes/nuevo"),
        },
      ]}
      busqueda={busqueda}
      onBuscar={setBusqueda}
      placeholder="Buscar..."
      onFiltrar={() => router.push("/(personal)/informes/filtros")}
      filtrosActivos={activeFilters}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          {activeFilters > 0 ? (
            <Pressable
              onPress={() => router.push("/(personal)/informes/filtros")}
              style={styles.summaryStrip}
            >
              <Ionicons name="funnel" size={14} color={tema.verde} />
              <Text style={styles.summaryText} numberOfLines={1}>
                {summarize(from, to)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={tema.verde} />
            </Pressable>
          ) : null}

          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
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
        </>
      )}
    </PantallaLista>
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
      style={({ pressed }) => [FILA_LISTA, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name="document-text-outline" size={20} color={tema.verde} />
      </View>
      <View style={styles.rowText}>
        {/* El cliente arriba, como en el portal: el título de un informe es
            derivado y casi siempre dice lo mismo, así que lo que distingue una
            fila de otra es de quién es. */}
        <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
          {nombreCliente(item.cliente)}
        </Text>
        {resumenDePropiedades(item.propiedades) ? (
          <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
            {resumenDePropiedades(item.propiedades)}
          </Text>
        ) : null}
        <Text variant="bodySmall" style={styles.metaLine}>
          {[
            `#${item.numero}`,
            item.version > 1 ? `v${item.version}` : null,
            formatGeneratedAt(item.generatedAt),
            `${item.visitasCount} visita${item.visitasCount === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
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
  return fechaSola(yyyymmdd, { day: "2-digit", month: "short" });
}

/** Lo que dice la tira de filtros puestos. Hoy solo el rango de fechas. */
function summarize(from: string | null, to: string | null): string {
  const parts: string[] = [];
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
    backgroundColor: tema.verde,
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
  summaryText: { flex: 1, color: tema.verde, fontSize: 13, fontWeight: "500" },
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
    backgroundColor: tema.verde,
    zIndex: 10,
  },
});
