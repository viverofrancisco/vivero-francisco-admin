import { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema, tarjeta, transicion } from "@/lib/tema";
import { hora12 } from "@/lib/hora";
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
import { estadoPildora, visitaTerminada } from "@/lib/estado-visita";
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
  // Los demás: el nombre del día solo. La fecha completa va en el subtítulo.
  return capitalizar(d.toLocaleDateString("es-EC", { weekday: "long" }));
}

/**
 * La fecha completa, siempre debajo del título.
 *
 * Aunque el título ya diga el día: el sistema pone un subtítulo fijo, y un
 * bloque que a veces tiene dos renglones y a veces uno hace saltar todo lo que
 * está abajo al cambiar de día.
 */
function subtituloCompleto(d: Date): string {
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

  return (
    <View style={styles.container}>
      {/* El selector de día: flechas para moverse de a uno —que es como se usa
          en el campo— y la fecha tocable para saltar lejos. */}
      {/* Título grande a la izquierda y controles a la derecha, como el sistema
          de diseño. El día se elige tocando el título; las flechas mueven de a
          uno, que es como se usa en el campo. */}
      <View style={[styles.appBar, { paddingTop: insets.top + 10 }]}>
        <PressableScale
          onPress={() => setAbrirPicker(true)}
          estiloExterno={styles.tituloBloque}
        >
          <View style={styles.tituloFila}>
            <Text style={styles.tituloGrande}>{titulo(fecha)}</Text>
            <Ionicons name="chevron-down" size={18} color={tema.texto3} />
          </View>
          <Text style={styles.tituloSub}>{subtituloCompleto(fecha)}</Text>
        </PressableScale>

        <View style={styles.flechas}>
          <PressableScale onPress={() => correr(-1)} style={styles.botonCuadrado}>
            <Ionicons name="chevron-back" size={20} color={tema.texto} />
          </PressableScale>
          <PressableScale onPress={() => correr(1)} style={styles.botonCuadrado}>
            <Ionicons name="chevron-forward" size={20} color={tema.texto} />
          </PressableScale>
        </View>
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
          ListHeaderComponent={
            items.length > 0 ? <TarjetaDeRuta visitas={items} /> : null
          }
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

  const pildora = estadoPildora(v.estado);

  return (
    <PressableScale
      onPress={onPress}
      estiloExterno={styles.filaExterna}
      style={[styles.row, terminada && styles.rowMuted]}
      estiloPresionado={styles.rowPressed}
    >
      {/* La franja del estado, a sangre en el borde. Es la del sistema de
          diseño: 5pt de alto completo, no la barrita flotante de antes. */}
      <View style={[styles.franja, { backgroundColor: pildora.punto }]} />

      <View style={styles.rowText}>
        {/* Hora y estado en la misma línea: el "cuándo" y el "cómo va". */}
        <View style={styles.filaSuperior}>
          <Text style={[styles.hora, !v.horaEntrada && styles.horaVacia]}>
            {v.horaEntrada ? hora12(v.horaEntrada) : "Sin hora"}
          </Text>
          <View style={[styles.pildora, { backgroundColor: pildora.fondo }]}>
            <View style={[styles.punto, { backgroundColor: pildora.punto }]} />
            <Text style={[styles.pildoraTexto, { color: pildora.color }]}>
              {pildora.etiqueta}
            </Text>
          </View>
        </View>

        <Text style={styles.rowTitle} numberOfLines={1}>
          {nombreCliente(cliente)}
        </Text>

        <Text style={styles.servicio} numberOfLines={1}>
          {resumenTareas(v)}
        </Text>

        {direccion ? (
          <View style={styles.linea}>
            <Ionicons name="location-outline" size={14} color={tema.texto3} />
            <Text style={styles.lineaTexto} numberOfLines={1}>
              {direccion}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/**
 * La ruta del día, arriba de la lista.
 *
 * Del sistema de diseño. Cuenta visitas **completadas**, que es un estado que
 * pone la oficina mirando lo que cargó cada uno — no el jardinero. Así que no
 * mide su desempeño: dice cuántas del día ya se cerraron y cuántas siguen
 * abiertas.
 *
 * Solo con más de una visita: "1 de 1" con una barra en cero es un adorno que
 * ocupa un tercio de la pantalla para decir lo que la única fila de abajo ya
 * dice.
 */
function TarjetaDeRuta({ visitas }: { visitas: VisitaDetail[] }) {
  if (visitas.length < 2) return null;
  const hechas = visitas.filter((v) => v.estado === "COMPLETADA").length;
  const pct = Math.round((hechas / visitas.length) * 100);

  return (
    <View style={styles.ruta}>
      <View style={styles.rutaTop}>
        <View>
          <Text style={styles.rutaEtiqueta}>RUTA DEL DÍA</Text>
          <Text style={styles.rutaNumero}>
            {hechas}
            <Text style={styles.rutaDe}> de {visitas.length} visitas</Text>
          </Text>
        </View>
        <View style={styles.rutaDerecha}>
          <Text style={styles.rutaPct}>{pct}%</Text>
          <Text style={styles.rutaPctSub}>completado</Text>
        </View>
      </View>
      <View style={styles.rutaBarra}>
        <View style={[styles.rutaBarraLlena, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

/** El contenedor de la lista se atenúa mientras llega otro día. */
const estiloLista = transicion("opacity", 150, { flex: 1 });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tema.fondo },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  /** La barra superior: título grande a la izquierda, controles a la derecha. */
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: tema.superficie,
    borderBottomWidth: 1,
    borderBottomColor: tema.linea,
  },
  tituloBloque: { flex: 1 },
  tituloFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  tituloGrande: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: tema.texto,
  },
  tituloSub: { fontSize: 13, fontWeight: "600", color: tema.texto3, marginTop: 3 },
  flechas: { flexDirection: "row", gap: 8 },
  /** Los botones cuadrados del sistema: 40pt, esquina 12, borde fino. */
  botonCuadrado: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.linea,
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: { padding: 18, paddingBottom: 96, gap: 10 },

  /** La tarjeta de ruta, en el verde profundo del sistema. */
  ruta: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: tema.verdeProfundo,
  },
  rutaTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rutaEtiqueta: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.6,
  },
  rutaNumero: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: -0.8, marginTop: 4 },
  rutaDe: { fontSize: 17, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  rutaDerecha: { alignItems: "flex-end" },
  rutaPct: { fontSize: 27, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  rutaPctSub: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  rutaBarra: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 14,
    overflow: "hidden",
  },
  rutaBarraLlena: { height: "100%", borderRadius: 999, backgroundColor: "#fff" },

  /** La fila: tarjeta del sistema con la franja de estado a sangre. */
  filaExterna: { borderRadius: 16 },
  row: { ...tarjeta, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },
  rowPressed: { backgroundColor: tema.lienzo },
  rowMuted: { opacity: 0.7 },
  franja: { width: 5 },
  rowText: { flex: 1, padding: 14, paddingLeft: 15, gap: 2, minWidth: 0 },
  filaSuperior: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 5,
  },
  hora: {
    fontSize: 17,
    fontWeight: "800",
    color: tema.texto,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  horaVacia: { fontSize: 13, fontWeight: "600", color: tema.texto3, letterSpacing: 0 },
  pildora: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 7,
    paddingRight: 9,
    borderRadius: 999,
  },
  punto: { width: 6, height: 6, borderRadius: 3 },
  pildoraTexto: { fontSize: 11.5, fontWeight: "700", letterSpacing: -0.1 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: tema.texto, letterSpacing: -0.2 },
  servicio: { fontSize: 13.5, fontWeight: "600", color: tema.verde700, marginTop: 1 },
  linea: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  lineaTexto: { fontSize: 12.5, fontWeight: "600", color: tema.texto3, flex: 1 },

  empty: { paddingVertical: 60, alignItems: "center", gap: 8 },
  emptyTitle: { color: tema.texto2 },
  emptyBody: { color: tema.texto3, textAlign: "center", paddingHorizontal: 24 },

  fab: { position: "absolute", right: 16, bottom: 16, backgroundColor: tema.verde },
});
