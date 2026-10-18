import { useCallback, useState } from "react";
import { estadoColor, estadoLabel, visitaTerminada } from "@/lib/estado-visita";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";
import { apiRequest } from "@/lib/api";
import { PantallaLista } from "@/components/ui/PantallaLista";
import type { VisitaDetail, VisitasListResponse } from "@/lib/types";
import { resumenTareas } from "@/lib/types";
import { diaEnEcuador, hoyEnEcuador } from "@/lib/hora";
import {
  diaISO,
  fechaSola,
  serviciosEnUnaLinea,
  sumarDias,
  type SolicitudItem,
} from "@vivero/shared";
import { EstadoSolicitud } from "@/components/solicitudes/FichaDeSolicitud";
import { tema } from "@/lib/tema";

type Group = "Hoy" | "Mañana" | "Esta semana" | "Más adelante" | "Historial";

/**
 * Una sección de la lista: visitas agrupadas por cuándo, o las solicitudes de
 * visita —arriba las pendientes, que es lo que el cliente está esperando; al
 * final las atendidas, por si quiere volver a ver qué pidió—.
 */
type Section =
  | { label: Group; visitas: VisitaDetail[] }
  | { label: "Solicitudes" | "Solicitudes atendidas"; solicitudes: SolicitudItem[] };

export default function ClienteVisitasListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<VisitaDetail[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /** `silencioso`: al volver a la pestaña, sin spinner de ningún tipo. */
  const load = useCallback(async (modo: "tirar" | "silencioso" = "tirar") => {
    if (modo === "tirar") setRefreshing(true);
    try {
      const [res, sol] = await Promise.all([
        apiRequest<VisitasListResponse>("/api/mobile/visitas", {
          query: { limit: 100 },
        }),
        apiRequest<{ items: SolicitudItem[] }>("/api/mobile/solicitudes", {
          query: { limit: 100 },
        }).catch(() => ({ items: [] as SolicitudItem[] })),
      ]);
      setItems(res.items);
      setSolicitudes(sol.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Cada vez que se vuelve a la pestaña —la primera incluida—: así la
  // solicitud recién enviada aparece sin tener que arrastrar.
  useFocusEffect(
    useCallback(() => {
      load("silencioso");
    }, [load])
  );

  const pendientes = solicitudes.filter((s) => !s.atendidaEl);
  const atendidas = solicitudes.filter((s) => s.atendidaEl);
  const sections: Section[] = [
    ...(pendientes.length ? [{ label: "Solicitudes" as const, solicitudes: pendientes }] : []),
    ...groupVisitas(items),
    ...(atendidas.length
      ? [{ label: "Solicitudes atendidas" as const, solicitudes: atendidas }]
      : []),
  ];
  const solicitar = () => router.push("/(cliente)/solicitudes/nueva");

  return (
    <PantallaLista
      titulo="Mis visitas"
      acciones={[
        { etiqueta: "Solicitar una visita", onPress: solicitar },
      ]}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
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
              Cuéntanos qué necesita tu jardín y coordinamos una visita.
              Te avisaremos por notificación cuando se programe.
            </Text>
            <Button mode="contained" onPress={solicitar} style={styles.emptyButton}>
              Solicitar una visita
            </Button>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <Text variant="labelMedium" style={styles.sectionLabel}>
              {item.label.toUpperCase()}
            </Text>
            <View style={styles.list}>
              {"solicitudes" in item ? item.solicitudes.map((s) => (
                <SolicitudRow
                  key={s.id}
                  solicitud={s}
                  onPress={() => router.push(`/(cliente)/visitas/solicitud/${s.id}`)}
                />
              )) : item.visitas.map((v) => (
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
      )}
    </PantallaLista>
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
  const terminada = visitaTerminada(v.estado);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        terminada && styles.rowMuted,
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
          {resumenTareas(v)}
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



function SolicitudRow({
  solicitud: s,
  onPress,
}: {
  solicitud: SolicitudItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        !!s.atendidaEl && styles.rowMuted,
      ]}
    >
      <View
        style={[
          styles.indicator,
          { backgroundColor: s.atendidaEl ? tema.verde : tema.ambar },
        ]}
      />
      <View style={styles.rowText}>
        <Text variant="bodyLarge" style={styles.rowTitle} numberOfLines={1}>
          {serviciosEnUnaLinea(s) ?? s.mensaje}
        </Text>
        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
          {s.atendidaEl
            ? s.visitas.length > 0
              ? "Visita agendada"
              : "Atendida"
            : "Un asesor te contactará pronto"}
        </Text>
      </View>
      <View style={styles.meta}>
        <EstadoSolicitud atendida={!!s.atendidaEl} />
        <Text variant="bodySmall" style={styles.metaSecondary}>
          {formatShortDate(diaEnEcuador(s.createdAt))}
        </Text>
      </View>
    </Pressable>
  );
}

function formatShortDate(iso: string): string {
  return fechaSola(iso, { day: "numeric", month: "short" });
}

/**
 * Las visitas por día, comparando **días** y no instantes.
 *
 * `fechaProgramada` es `@db.Date` y llega como medianoche UTC: convertirla a
 * `Date` la corría cinco horas atrás, así que la visita de hoy caía en el día
 * anterior y terminaba en Historial en vez de en Hoy. Comparar los
 * `YYYY-MM-DD` en crudo no depende de ninguna zona, y en ese formato el texto
 * ordena igual que la fecha.
 */
function groupVisitas(visitas: VisitaDetail[]): { label: Group; visitas: VisitaDetail[] }[] {
  const hoy = hoyEnEcuador();
  const manana = sumarDias(hoy, 1);
  const finDeSemana = sumarDias(hoy, 7);

  const buckets: Record<Group, VisitaDetail[]> = {
    Hoy: [],
    Mañana: [],
    "Esta semana": [],
    "Más adelante": [],
    Historial: [],
  };

  for (const v of visitas) {
    const dia = diaISO(v.fechaProgramada);
    const isUpcoming = v.estado === "PROGRAMADA" && dia >= hoy;

    if (!isUpcoming) {
      buckets["Historial"].push(v);
      continue;
    }
    if (dia === hoy) buckets["Hoy"].push(v);
    else if (dia === manana) buckets["Mañana"].push(v);
    else if (dia < finDeSemana) buckets["Esta semana"].push(v);
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
  emptyButton: { marginTop: 12, borderRadius: 12 },
});
