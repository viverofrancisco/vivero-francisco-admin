import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Calendar, type DateData } from "react-native-calendars";
import { useInformesFilters } from "@/lib/informes-filters-store";

const ACCENT = "#2e7d32";

export default function FiltrosScreen() {
  const router = useRouter();
  const { cliente, from, to, setCliente, setFrom, setTo, clear, activeCount } =
    useInformesFilters();

  const active = activeCount();

  const markedDates = useMemo(
    () => buildMarkedDates(from, to),
    [from, to]
  );

  function handleDayPress(d: DateData) {
    const day = d.dateString; // YYYY-MM-DD

    // No selection yet → start with single-day range
    if (!from && !to) {
      setFrom(day);
      setTo(day);
      return;
    }

    // Range complete (from !== to) → restart
    if (from && to && from !== to) {
      setFrom(day);
      setTo(day);
      return;
    }

    // Single day selected → either deselect, extend, or replace
    if (from && to && from === to) {
      if (day === from) {
        // Tap same day → clear
        setFrom(null);
        setTo(null);
        return;
      }
      if (day > from) {
        setTo(day);
      } else {
        setTo(from);
        setFrom(day);
      }
      return;
    }

    // Fallback (shouldn't happen with store always keeping pair)
    setFrom(day);
    setTo(day);
  }

  const dateLabel = useMemo(() => {
    if (!from && !to) return "Sin fecha";
    if (from && to && from === to) return formatLongDate(from);
    if (from && to) return `${formatChipDate(from)} → ${formatChipDate(to)}`;
    if (from) return `Desde ${formatChipDate(from)}`;
    return `Hasta ${formatChipDate(to ?? "")}`;
  }, [from, to]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Filtros",
          headerBackVisible: false,
          headerLeft: () => null,
          headerRight: () =>
            active > 0 ? (
              <Button compact onPress={clear} textColor="#c62828">
                Limpiar
              </Button>
            ) : null,
        }}
      />

      <View style={styles.screen}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
        >
          <Section title="Cliente">
          <Pressable
            onPress={() =>
              router.push("/(personal)/informes/filtros-cliente")
            }
            style={({ pressed }) => [
              styles.row,
              styles.rowLast,
              pressed && styles.rowPressed,
            ]}
          >
            <Text style={styles.rowLabel}>Cliente</Text>
            <View style={styles.rowRight}>
              <Text
                style={[
                  styles.rowValue,
                  cliente && styles.rowValueActive,
                ]}
                numberOfLines={1}
              >
                {cliente?.nombre ?? "Todos"}
              </Text>
              {cliente ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setCliente(null);
                  }}
                  hitSlop={10}
                >
                  <Ionicons name="close-circle" size={18} color="#bdbdbd" />
                </Pressable>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
            </View>
          </Pressable>
        </Section>

        <Section title="Fecha de generación">
          <View style={styles.calendarWrap}>
            <View style={styles.calendarHeader}>
              <Text
                style={[styles.calendarValue, !from && styles.muted]}
              >
                {dateLabel}
              </Text>
              {from || to ? (
                <Pressable
                  onPress={() => {
                    setFrom(null);
                    setTo(null);
                  }}
                  hitSlop={10}
                >
                  <Text style={styles.clearLink}>Limpiar</Text>
                </Pressable>
              ) : null}
            </View>
            <Calendar
              markingType="period"
              markedDates={markedDates}
              onDayPress={handleDayPress}
              theme={{
                todayTextColor: ACCENT,
                arrowColor: ACCENT,
                monthTextColor: "#222",
                textMonthFontWeight: "600",
                textDayFontSize: 14,
                textMonthFontSize: 15,
              }}
              firstDay={1}
            />
            <Text style={styles.hint}>
              Toca un día para seleccionarlo. Toca otro día para crear un rango.
            </Text>
          </View>
        </Section>
        </ScrollView>
        <View style={styles.bottomBar}>
          <Button
            mode="contained"
            onPress={() => router.back()}
            style={styles.applyBtn}
            contentStyle={styles.applyContent}
            buttonColor={ACCENT}
          >
            {active > 0 ? "Aplicar filtros" : "Listo"}
          </Button>
        </View>
      </View>
    </>
  );
}

function buildMarkedDates(from: string | null, to: string | null) {
  if (!from && !to) return {};
  const out: Record<
    string,
    {
      startingDay?: boolean;
      endingDay?: boolean;
      color: string;
      textColor: string;
    }
  > = {};
  if (from && to && from === to) {
    out[from] = {
      startingDay: true,
      endingDay: true,
      color: ACCENT,
      textColor: "#fff",
    };
    return out;
  }
  if (from && to && from !== to) {
    const start = from < to ? from : to;
    const end = from < to ? to : from;
    let cursor = start;
    while (cursor <= end) {
      out[cursor] = {
        color: ACCENT,
        textColor: "#fff",
        ...(cursor === start ? { startingDay: true } : {}),
        ...(cursor === end ? { endingDay: true } : {}),
      };
      cursor = nextDay(cursor);
      // safety guard
      if (Object.keys(out).length > 400) break;
    }
    return out;
  }
  // Only one bound set
  const single = (from ?? to)!;
  out[single] = {
    startingDay: true,
    endingDay: true,
    color: ACCENT,
    textColor: "#fff",
  };
  return out;
}

function nextDay(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function formatLongDate(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  return d.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatChipDate(yyyymmdd: string): string {
  const d = new Date(yyyymmdd + "T00:00:00");
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f5f5" },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { paddingVertical: 16, paddingBottom: 24 },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  applyBtn: { borderRadius: 12 },
  applyContent: { paddingVertical: 6 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    color: "#888",
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingHorizontal: 24,
  },
  sectionBody: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e0e0e0",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: "#f5f5f5" },
  rowLabel: { flex: 1, color: "#222", fontSize: 16 },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    maxWidth: "60%",
  },
  rowValue: { color: "#888", fontSize: 15, flexShrink: 1 },
  rowValueActive: { color: "#2e7d32", fontWeight: "500" },
  calendarWrap: { padding: 8 },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  calendarValue: { color: "#222", fontWeight: "500", fontSize: 15 },
  muted: { color: "#888", fontWeight: "400" },
  clearLink: { color: "#c62828", fontSize: 13, fontWeight: "500" },
  hint: {
    paddingHorizontal: 8,
    paddingTop: 8,
    color: "#888",
    fontSize: 12,
  },
});
