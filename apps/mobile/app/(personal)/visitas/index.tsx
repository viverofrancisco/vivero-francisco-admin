import { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, FAB, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { nombreCliente } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { visitaTerminada } from "@/lib/estado-visita";
import type { VisitaDetail, VisitasListResponse } from "@/lib/types";
import { resumenTareas } from "@/lib/types";

/**
 * Las visitas de **un día**, con hoy por defecto.
 *
 * Antes mostraba todo lo que venía, agrupado en hoy / mañana / esta semana /
 * más adelante. Quien abre esto en el jardín viene a ver lo de hoy: el resto
 * era una lista larga por la que había que pasar, y lo de hoy —una o dos
 * filas— quedaba arriba de todo eso.
 *
 * El día se cambia con las flechas o tocando la fecha. Se pide al servidor y no
 * se filtra en el teléfono: una semana adelante o un mes atrás son visitas que
 * nunca se trajeron.
 */

/** El día de hoy, a medianoche local. Es el ancla de todo lo demás. */
function hoyLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * El día elegido, como instante que el servidor no pueda malinterpretar.
 *
 * Mediodía UTC y no medianoche local: `fechaProgramada` es `@db.Date` y Prisma
 * le manda a Postgres la parte de fecha del instante en UTC, así que una
 * medianoche local al este de Greenwich caería en el día anterior.
 */
function comoParametro(d: Date): string {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)
  ).toISOString();
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function titulo(d: Date): string {
  const hoy = hoyLocal();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  if (mismoDia(d, hoy)) return "Hoy";
  if (mismoDia(d, ayer)) return "Ayer";
  if (mismoDia(d, manana)) return "Mañana";
  return capitalizar(
    d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })
  );
}

/** La fecha completa, debajo del título, cuando el título no la dice. */
function subtitulo(d: Date): string | null {
  const t = titulo(d);
  if (t !== "Hoy" && t !== "Ayer" && t !== "Mañana") return null;
  return capitalizar(
    d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })
  );
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function PersonalVisitasListScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const canCreate = role === "ADMIN" || role === "STAFF";

  const [fecha, setFecha] = useState<Date>(hoyLocal);
  const [items, setItems] = useState<VisitaDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [abrirPicker, setAbrirPicker] = useState(false);
  // La pantalla no tiene encabezado, así que el hueco de la barra de estado lo
  // deja ella.
  const insets = useSafeAreaInsets();

  const load = useCallback(
    async (dia: Date, refrescando = false) => {
      if (refrescando) setRefreshing(true);
      else setLoading(true);
      try {
        const iso = comoParametro(dia);
        const res = await apiRequest<VisitasListResponse>("/api/mobile/visitas", {
          query: { from: iso, to: iso, limit: 100 },
        });
        setItems(res.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    load(fecha);
  }, [fecha, load]);

  function correr(dias: number) {
    const siguiente = new Date(fecha);
    siguiente.setDate(siguiente.getDate() + dias);
    setFecha(siguiente);
  }

  const esHoy = mismoDia(fecha, hoyLocal());
  const bajoTitulo = subtitulo(fecha);

  return (
    <View style={styles.container}>
      {/* El selector de día: flechas para moverse de a uno —que es como se usa
          en el campo— y la fecha tocable para saltar lejos. */}
      <View style={[styles.selector, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => correr(-1)} hitSlop={10} style={styles.flecha}>
          <Ionicons name="chevron-back" size={22} color="#2e7d32" />
        </Pressable>

        <Pressable onPress={() => setAbrirPicker(true)} style={styles.fechaBoton}>
          <Text variant="titleMedium" style={styles.fechaTitulo}>
            {titulo(fecha)}
          </Text>
          {bajoTitulo ? (
            <Text style={styles.fechaSub}>{bajoTitulo}</Text>
          ) : null}
        </Pressable>

        <Pressable onPress={() => correr(1)} hitSlop={10} style={styles.flecha}>
          <Ionicons name="chevron-forward" size={22} color="#2e7d32" />
        </Pressable>
      </View>

      {!esHoy ? (
        <Pressable onPress={() => setFecha(hoyLocal())} style={styles.volverHoy}>
          <Text style={styles.volverHoyTexto}>Volver a hoy</Text>
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(fecha, true)}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color="#ccc" />
              <Text variant="titleMedium" style={styles.emptyTitle}>
                {esHoy ? "Hoy no tienes visitas" : "No hay visitas este día"}
              </Text>
              <Text variant="bodyMedium" style={styles.emptyBody}>
                {canCreate
                  ? "Toca el botón + para programar una."
                  : "Usa las flechas para ver otro día."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <VisitaRow
              visita={item}
              onPress={() => router.push(`/(personal)/visitas/${item.id}`)}
            />
          )}
        />
      )}

      {abrirPicker ? (
        <DateTimePicker
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          value={fecha}
          onChange={(_e, elegida) => {
            setAbrirPicker(false);
            if (elegida) {
              setFecha(
                new Date(
                  elegida.getFullYear(),
                  elegida.getMonth(),
                  elegida.getDate()
                )
              );
            }
          }}
        />
      ) : null}

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

/**
 * Una visita del día.
 *
 * Con la dirección, que es lo que hace falta para llegar: antes decía el
 * cliente y el sector, y el sector dice el barrio, no la casa.
 */
function VisitaRow({
  visita: v,
  onPress,
}: {
  visita: VisitaDetail;
  onPress: () => void;
}) {
  const cliente = v.cliente;
  const terminada = visitaTerminada(v.estado);
  const direccion = [cliente.direccion, cliente.sector?.nombre]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        terminada && styles.rowMuted,
      ]}
    >
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
            {nombreCliente(cliente)}
          </Text>
          {v.horaEntrada ? (
            <Text style={styles.hora}>{v.horaEntrada}</Text>
          ) : null}
        </View>

        {direccion ? (
          <View style={styles.linea}>
            <Ionicons name="location-outline" size={13} color="#888" />
            <Text style={styles.lineaTexto} numberOfLines={1}>
              {direccion}
            </Text>
          </View>
        ) : null}

        <View style={styles.linea}>
          <Ionicons name="leaf-outline" size={13} color="#888" />
          <Text style={styles.lineaTexto} numberOfLines={1}>
            {resumenTareas(v)}
          </Text>
        </View>

        {cliente.telefono ? (
          <View style={styles.linea}>
            <Ionicons name="call-outline" size={13} color="#888" />
            <Text style={styles.lineaTexto}>{cliente.telefono}</Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#c4c4c4" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  selector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e6e6e6",
  },
  flecha: { padding: 10 },
  fechaBoton: { flex: 1, alignItems: "center" },
  fechaTitulo: { color: "#111", fontWeight: "700" },
  fechaSub: { color: "#888", fontSize: 12, marginTop: 1 },
  volverHoy: { alignSelf: "center", paddingVertical: 8 },
  volverHoyTexto: { color: "#2e7d32", fontWeight: "600", fontSize: 13 },

  listContent: { padding: 16, paddingBottom: 96, gap: 10 },
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
  rowText: { flex: 1, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { color: "#111", fontWeight: "700", flex: 1 },
  hora: { color: "#2e7d32", fontWeight: "700", fontSize: 13 },
  linea: { flexDirection: "row", alignItems: "center", gap: 5 },
  lineaTexto: { color: "#888", fontSize: 12.5, flex: 1 },

  empty: { paddingVertical: 60, alignItems: "center", gap: 8 },
  emptyTitle: { color: "#444" },
  emptyBody: { color: "#888", textAlign: "center", paddingHorizontal: 24 },

  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#2e7d32",
  },
});
