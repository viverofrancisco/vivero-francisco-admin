import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { apiRequest } from "@/lib/api";
import type { VisitaDetail, VisitasListResponse } from "@/lib/types";

type Group = "Hoy" | "Mañana" | "Esta semana" | "Más adelante" | "Historial";

interface Section {
  label: Group;
  visitas: VisitaDetail[];
}

export default function ClienteVisitasListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<VisitaDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiRequest<VisitasListResponse>(
        "/api/mobile/visitas",
        { query: { limit: 100 } }
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
    load(true);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const sections = groupVisitas(items);

  return (
    <View style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={(s) => s.label}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load()} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              Aún no tienes visitas
            </Text>
            <Text variant="bodyMedium" style={styles.emptyBody}>
              Te avisaremos por notificación cuando se programe una.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <Text variant="labelMedium" style={styles.sectionLabel}>
              {item.label.toUpperCase()}
            </Text>
            <View style={styles.list}>
              {item.visitas.map((v) => (
                <VisitaRow
                  key={v.id}
                  visita={v}
                  showDate={
                    item.label !== "Hoy" && item.label !== "Mañana"
                  }
                  onPress={() => router.push(`/(cliente)/visitas/${v.id}`)}
                />
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function VisitaRow({
  visita: v,
  showDate,
  onPress,
}: {
  visita: VisitaDetail;
  showDate: boolean;
  onPress: () => void;
}) {
  const isCompleted = v.estado !== "PROGRAMADA";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        isCompleted && styles.rowMuted,
      ]}
    >
      <View
        style={[
          styles.indicator,
          { backgroundColor: estadoColor(v.estado) },
        ]}
      />
      <View style={styles.rowText}>
        <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
          {v.clienteServicio.servicio.nombre}
        </Text>
        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
          {estadoLabel(v.estado)}
        </Text>
      </View>
      <View style={styles.meta}>
        {showDate ? (
          <Text variant="bodySmall" style={styles.metaPrimary}>
            {formatShortDate(v.fechaProgramada)}
          </Text>
        ) : null}
        {v.horaEntrada ? (
          <Text variant="bodySmall" style={styles.metaSecondary}>
            {v.horaEntrada}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function estadoLabel(estado: string): string {
  switch (estado) {
    case "PROGRAMADA":
      return "Programada";
    case "COMPLETADA":
      return "Completada";
    case "INCOMPLETA":
      return "Incompleta";
    case "CANCELADA":
      return "Cancelada";
    default:
      return estado;
  }
}

function estadoColor(estado: string): string {
  switch (estado) {
    case "PROGRAMADA":
      return "#2e7d32";
    case "COMPLETADA":
      return "#9e9e9e";
    case "INCOMPLETA":
      return "#f57c00";
    case "CANCELADA":
      return "#c62828";
    default:
      return "#bdbdbd";
  }
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short" });
}

function groupVisitas(visitas: VisitaDetail[]): Section[] {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);

  const buckets: Record<Group, VisitaDetail[]> = {
    Hoy: [],
    Mañana: [],
    "Esta semana": [],
    "Más adelante": [],
    Historial: [],
  };

  for (const v of visitas) {
    const d = startOfDay(new Date(v.fechaProgramada));
    const isUpcoming =
      v.estado === "PROGRAMADA" && d.getTime() >= today.getTime();

    if (!isUpcoming) {
      buckets["Historial"].push(v);
      continue;
    }
    if (d.getTime() === today.getTime()) buckets["Hoy"].push(v);
    else if (d.getTime() === tomorrow.getTime()) buckets["Mañana"].push(v);
    else if (d.getTime() < weekEnd.getTime()) buckets["Esta semana"].push(v);
    else buckets["Más adelante"].push(v);
  }

  // Sort historial newest first; rest oldest first.
  buckets["Historial"].sort(
    (a, b) =>
      new Date(b.fechaProgramada).getTime() -
      new Date(a.fechaProgramada).getTime()
  );
  for (const k of ["Hoy", "Mañana", "Esta semana", "Más adelante"] as Group[]) {
    buckets[k].sort(
      (a, b) =>
        new Date(a.fechaProgramada).getTime() -
        new Date(b.fechaProgramada).getTime()
    );
  }

  return (Object.entries(buckets) as [Group, VisitaDetail[]][])
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, visitas: list }));
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, paddingBottom: 32, gap: 20 },

  section: { gap: 8 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  list: { gap: 6 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#fafafa",
    gap: 12,
  },
  rowPressed: { backgroundColor: "#eaeaea" },
  rowMuted: { opacity: 0.6 },
  indicator: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: "#111", fontWeight: "500" },
  muted: { color: "#888" },
  meta: { alignItems: "flex-end", gap: 2 },
  metaPrimary: { color: "#111", fontWeight: "500" },
  metaSecondary: { color: "#888" },

  empty: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: "#444" },
  emptyBody: { color: "#888", textAlign: "center", paddingHorizontal: 24 },
});
