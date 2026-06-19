import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, FAB, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { nombreCliente } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { VisitaDetail, VisitasListResponse } from "@/lib/types";

type Group = "Hoy" | "Mañana" | "Esta semana" | "Más adelante";

interface Section {
  label: Group;
  visitas: VisitaDetail[];
}

export default function PersonalVisitasListScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = role === "ADMIN" || role === "PERSONAL_ADMIN";
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
              No hay visitas
            </Text>
            <Text variant="bodyMedium" style={styles.emptyBody}>
              {canCreate
                ? "Toca el botón + para programar una nueva visita."
                : "Cuando tengas visitas asignadas las verás aquí."}
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
                  showDate={item.label === "Esta semana" || item.label === "Más adelante"}
                  onPress={() => router.push(`/(personal)/visitas/${v.id}`)}
                />
              ))}
            </View>
          </View>
        )}
      />
      {canCreate ? (
        <FAB
          icon="plus"
          color="#fff"
          style={styles.fab}
          onPress={() => router.push("/(personal)/visitas/nueva")}
        />
      ) : null}
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
  const cliente = v.clienteServicio.cliente;
  const sector = cliente.sector?.nombre;
  const subtitleParts = [v.clienteServicio.servicio.nombre, sector].filter(
    Boolean
  );
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
          {nombreCliente(cliente)}
        </Text>
        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
          {subtitleParts.join(" · ")}
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

function estadoColor(estado: string): string {
  switch (estado) {
    case "PROGRAMADA":
      return "#2e7d32"; // green
    case "COMPLETADA":
      return "#9e9e9e"; // gray
    case "INCOMPLETA":
      return "#f57c00"; // amber
    case "CANCELADA":
      return "#c62828"; // red
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
  };

  for (const v of visitas) {
    const d = startOfDay(new Date(v.fechaProgramada));
    if (d.getTime() === today.getTime()) buckets["Hoy"].push(v);
    else if (d.getTime() === tomorrow.getTime()) buckets["Mañana"].push(v);
    else if (d.getTime() < weekEnd.getTime()) buckets["Esta semana"].push(v);
    else buckets["Más adelante"].push(v);
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
  listContent: { padding: 16, paddingBottom: 96, gap: 20 },

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
  rowPressed: {
    backgroundColor: "#eaeaea",
  },
  rowMuted: {
    opacity: 0.6,
  },
  indicator: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: { color: "#111", fontWeight: "500" },
  muted: { color: "#888" },
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
