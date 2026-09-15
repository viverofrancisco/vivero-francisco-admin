import { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema, transicion } from "@/lib/tema";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { FAB, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SelectorFecha } from "@/components/SelectorFecha";
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
        <PressableScale onPress={() => correr(-1)} hitSlop={10} style={styles.flecha}>
          <Ionicons name="chevron-back" size={22} color={tema.verde} />
        </PressableScale>

        <PressableScale onPress={() => setAbrirPicker(true)} style={styles.fechaBoton}>
          <Text variant="titleMedium" style={styles.fechaTitulo}>
            {titulo(fecha)}
          </Text>
          {bajoTitulo ? (
            <Text style={styles.fechaSub}>{bajoTitulo}</Text>
          ) : null}
        </PressableScale>

        <PressableScale onPress={() => correr(1)} hitSlop={10} style={styles.flecha}>
          <Ionicons name="chevron-forward" size={22} color={tema.verde} />
        </PressableScale>
      </View>

      {/* La lista no se desmonta al cambiar de día: se atenúa mientras llega la
          nueva. Reemplazarla por un spinner a pantalla completa hacía que
          moverse un día pareciera que la app se recargaba sola —y el spinner
          aparecía y desaparecía tan rápido que era un parpadeo, no información.
          Es el mismo criterio que ya usa el portal en sus listas. */}
      <Animated.View style={[estiloLista, loading && { opacity: 0.45 }]}>
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
      </Animated.View>

      <SelectorFecha
        visible={abrirPicker}
        valor={fecha}
        onElegir={(d) => {
          setFecha(d);
          setAbrirPicker(false);
        }}
        onCerrar={() => setAbrirPicker(false)}
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
    <PressableScale
      onPress={onPress}
      style={[styles.row, terminada && styles.rowMuted]}
      estiloPresionado={styles.rowPressed}
    >
      {/* La hora arriba, sola y grande: es lo primero que se busca al abrir la
          pantalla —"¿a qué hora voy?"— y estaba perdida a la derecha del
          nombre, del mismo tamaño que todo lo demás. */}
      <View style={styles.horaColumna}>
        <Text style={[styles.hora, !v.horaEntrada && styles.horaVacia]}>
          {v.horaEntrada ?? "—"}
        </Text>
      </View>

      <View style={styles.rowText}>
        <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
          {nombreCliente(cliente)}
        </Text>

        {direccion ? (
          <View style={styles.linea}>
            <Ionicons name="location-outline" size={13} color={tema.textoTenue} />
            <Text style={styles.lineaTexto} numberOfLines={1}>
              {direccion}
            </Text>
          </View>
        ) : null}

        <View style={styles.linea}>
          <Ionicons name="leaf-outline" size={13} color={tema.textoTenue} />
          <Text style={styles.lineaTexto} numberOfLines={1}>
            {resumenTareas(v)}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#c4c4c4" />
    </PressableScale>
  );
}

/** El contenedor de la lista se atenúa mientras llega otro día. */
const estiloLista = transicion("opacity", 150, { flex: 1 });

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

  listContent: { padding: 16, paddingBottom: 96, gap: 10 },
  /**
   * La fila, como tarjeta.
   *
   * Era un rectángulo gris sobre blanco, con el nombre y tres renglones del
   * mismo gris apagado: todo pesaba lo mismo, así que nada se leía primero. Lo
   * que ordena la jerarquía es la hora —a la izquierda, sola, en su propia
   * columna— porque "¿a qué hora voy?" es la pregunta con la que se abre esta
   * pantalla.
   *
   * Fondo blanco con borde y una sombra corta, en vez de gris sobre blanco: el
   * gris hacía que la fila pareciera deshabilitada.
   */
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: tema.fondo,
    borderWidth: 1,
    borderColor: tema.borde,
    gap: 14,
    // La sombra es de opacidad baja y radio corto: una tarjeta que flota tres
    // píxeles, no una que levita.
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowPressed: { backgroundColor: tema.superficie },
  rowMuted: { opacity: 0.55 },
  horaColumna: { width: 46, alignItems: "flex-start" },
  hora: {
    color: tema.verde,
    fontWeight: "800",
    fontSize: 16,
    // Los números no bailan al cambiar de fila.
    fontVariant: ["tabular-nums"],
  },
  horaVacia: { color: "#c4c4c4", fontWeight: "600" },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { color: tema.texto, fontWeight: "700" },
  linea: { flexDirection: "row", alignItems: "center", gap: 5 },
  lineaTexto: { color: tema.textoTenue, fontSize: 12.5, flex: 1 },

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
