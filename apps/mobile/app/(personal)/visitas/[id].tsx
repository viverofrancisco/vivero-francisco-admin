import React, { useCallback, useEffect, useState } from "react";
import { estadoLabel } from "@/lib/estado-visita";
import {
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  Text,
} from "react-native-paper";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import { nombreCliente } from "@vivero/shared";
import { apiRequest, ApiError } from "@/lib/api";
import { ArchivosVisita } from "@/components/ArchivosVisita";
import type { TareaDeCatalogo } from "@/components/VisitaResultForm";
import type { VisitaDetail } from "@/lib/types";
import { listaTareas } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";
import { MediaViewer, type MediaViewerSource } from "@/components/MediaViewer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

/**
 * Si la visita es de hoy, comparando por día y no por instante.
 *
 * `fechaProgramada` es `@db.Date` y llega como medianoche **UTC**; compararla
 * con un `Date` local haría que una visita de mañana pareciera de hoy al oeste
 * de Greenwich. Por eso se comparan las dos como texto `AAAA-MM-DD` en UTC.
 */
function mismoDiaQueHoy(fechaProgramada: string): boolean {
  const hoy = new Date();
  const hoyUTC = new Date(
    Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  );
  return fechaProgramada.slice(0, 10) === hoyUTC.toISOString().slice(0, 10);
}

export default function PersonalVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const personalId = useAuthStore((s) => s.user?.personalId ?? null);
  const [visita, setVisita] = useState<VisitaDetail | null>(null);
  const [catalogo, setCatalogo] = useState<TareaDeCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoThumbs, setVideoThumbs] = useState<Record<string, string>>({});
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(null);

  useEffect(() => {
    if (!visita) return;
    const videos = visita.media.filter((m) => m.tipo === "video");
    let cancelled = false;
    videos.forEach(async (m) => {
      if (videoThumbs[m.id]) return;
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(m.url, {
          time: 1000,
          quality: 0.6,
        });
        if (!cancelled) {
          setVideoThumbs((prev) => ({ ...prev, [m.id]: uri }));
        }
      } catch {
        // Leave fallback placeholder.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visita, videoThumbs]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // El catálogo entero viene con la visita: la etiqueta de una foto puede
      // ser **cualquier** tarea viva, no solo las que uno marcó. En el campo se
      // fotografía lo que aparece.
      const [v, t] = await Promise.all([
        apiRequest<VisitaDetail>(`/api/mobile/visitas/${id}`),
        apiRequest<{ items: TareaDeCatalogo[] }>("/api/mobile/tareas").catch(
          () => ({ items: [] as TareaDeCatalogo[] })
        ),
      ]);
      setVisita(v);
      setCatalogo(t.items);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos cargar la visita");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Al volver de cargar el parte, se recarga para mostrarlo.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!visita) {
    return (
      <View style={styles.center}>
        <Text variant="bodyMedium" style={styles.muted}>
          No pudimos cargar esta visita.
        </Text>
        <Button onPress={() => router.back()}>Volver</Button>
      </View>
    );
  }

  // Una cancelada es de solo lectura; en cualquier otra se puede cargar el
  // parte propio. **No se cierra desde acá**: decir que el trabajo está
  // terminado es mirar lo que cargaron todos, y eso se hace desde el portal.
  const canAct = visita.estado !== "CANCELADA";
  /**
   * El botón dice el próximo paso, no lo que la pantalla hace.
   *
   * Decía "Cargar lo que hice" desde antes de que la entrada y la salida se
   * marcaran con un botón. Ahora hay tres momentos y cada uno pide algo
   * distinto: llegar, irse, y corregir después.
   */
  const mio = (visita.personal ?? []).find((p) => p.personalId === personalId);

  /**
   * Marcar entrada solo el día de la visita.
   *
   * El servidor no lo exige —una visita del mes pasado se puede cargar, que es
   * cuando hace falta— pero la app no tiene por qué ofrecerlo: marcar la
   * entrada de mañana no significa nada, y la de la semana pasada es fechar
   * hacia atrás algo que dice "estuve acá a esta hora". Si de verdad hay que
   * arreglar una vieja, lo hace la oficina corrigiendo el instante.
   *
   * **La salida no lleva esta regla.** Quien entró sigue pudiendo salir aunque
   * el día haya cambiado: un turno que cruza la medianoche termina en una fecha
   * distinta a la de la visita, y esconderle el botón lo dejaría adentro.
   */
  const esDeHoy = mismoDiaQueHoy(visita.fechaProgramada);
  const accion = !mio
    ? null
    : !mio.entradaEl
      ? esDeHoy
        ? "Marcar entrada"
        : null
      : !mio.salidaEl
        ? "Marcar salida"
        : "Editar mi parte";
  const cliente = visita.cliente;
  const personalAsignado = visita.personal ?? [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 6 }]}>
        {/* La flecha a la izquierda del nombre. El estado no está acá: ya se
            lee en la fila de la lista de donde se vino, y repetirlo arriba de
            todo gasta la línea más visible de la pantalla en algo que no se
            hace nada con él. Vive abajo, en Cuándo, junto al resto del
            historial de la visita. */}
        <View style={styles.encabezado}>
          <PressableScale
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.volver}
          >
            <Ionicons name="chevron-back" size={24} color={tema.texto} />
          </PressableScale>
          <View style={styles.encabezadoTexto}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {nombreCliente(cliente)}
            </Text>
            <Text style={styles.heroSubtitle} numberOfLines={1}>
              {listaTareas(visita)}
            </Text>
          </View>
        </View>

        {/* Cuándo */}
        <Section title="Cuándo">
          <Row label="Estado" value={estadoLabel(visita.estado)} />
          <Row label="Programada" value={formatDate(visita.fechaProgramada)} />
          {visita.fechaRealizada ? (
            <Row
              label="Realizada"
              value={formatDate(visita.fechaRealizada)}
            />
          ) : null}
          {visita.horaEntrada ? (
            <Row
              label={
                visita.estado === "PROGRAMADA"
                  ? "Hora estimada"
                  : "Hora de entrada"
              }
              value={visita.horaEntrada}
            />
          ) : null}
          {visita.horaSalida ? (
            <Row label="Hora de salida" value={visita.horaSalida} />
          ) : null}
        </Section>

        {/* Cliente */}
        <Section title="Cliente">
          {cliente.telefono ? (
            <Row label="Teléfono" value={cliente.telefono} />
          ) : null}
          {cliente.direccion ? (
            <Row label="Dirección" value={cliente.direccion} />
          ) : null}
          {cliente.sector ? (
            <Row label="Sector" value={cliente.sector.nombre} />
          ) : null}
        </Section>

        {/* Personal */}
        {personalAsignado.length > 0 ? (
          <Section title="Personal asignado">
            {personalAsignado.map((p) => (
              <View key={p.personalId} style={styles.personRow}>
                <Text variant="bodyMedium" style={styles.personName}>
                  {`${p.personal.nombre} ${p.personal.apellido ?? ""}`.trim()}
                </Text>
                {p.personal.tipo ? (
                  <Text variant="bodySmall" style={styles.personTipo}>
                    {tipoLabel(p.personal.tipo)}
                  </Text>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {/* Notas */}
        {visita.notas || visita.notasIncompleto ? (
          <Section
            title={
              visita.estado === "INCOMPLETA" || visita.estado === "CANCELADA"
                ? "Motivo"
                : "Notas"
            }
          >
            <Text variant="bodyMedium" style={styles.notasText}>
              {visita.notasIncompleto || visita.notas}
            </Text>
          </Section>
        ) : null}

        {/* Los archivos son de la visita, no de un formulario: se suben en
            cualquier momento y en cualquier estado, porque la foto se saca
            mientras se trabaja. Estaban dentro del formulario de salida, donde
            llegaban tarde. */}
        {canAct ? (
          <View style={styles.mediaSection}>
            <Text variant="labelMedium" style={styles.sectionLabel}>
              ARCHIVOS
            </Text>
            <ArchivosVisita
              visitaId={visita.id}
              archivos={visita.media ?? []}
              catalogo={catalogo}
              onCambio={load}
            />
          </View>
        ) : null}

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}
      </ScrollView>

      {/* Sticky actions */}
      <View style={styles.footer}>
        {canAct && !accion && mio && !mio.entradaEl ? (
          <Text style={styles.soloHoy}>
            La entrada se marca el día de la visita.
          </Text>
        ) : null}
        {canAct && accion ? (
          <Button
            mode="contained"
            onPress={() =>
              router.push(`/(personal)/visitas/completar/${visita.id}`)
            }
            style={styles.primaryBtn}
            contentStyle={styles.primaryBtnContent}
            labelStyle={styles.primaryBtnLabel}
          >
            {accion}
          </Button>
        ) : null}
      </View>

      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      <Text variant="labelMedium" style={styles.sectionLabel}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.sectionContent}>
        {items.map((child, i) => (
          <View key={i}>
            {child}
            {i < items.length - 1 ? <View style={styles.rowDivider} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={styles.rowLabel}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case "JARDINERO":
      return "Jardinero";
    case "CHOFER":
      return "Chofer";
    case "SUPERVISOR":
      return "Supervisor";
    case "MECANICO":
      return "Mecánico";
    default:
      return tipo;
  }
}




const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#fff",
  },
  muted: { color: "#888" },

  /** La flecha y el nombre en una línea, como pide el sistema de diseño. */
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 16,
  },
  volver: {
    width: 40,
    height: 40,
    marginLeft: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  encabezadoTexto: { flex: 1, gap: 2 },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: tema.texto,
  },
  heroSubtitle: { fontSize: 13.5, fontWeight: "600", color: tema.texto3 },


  soloHoy: {
    textAlign: "center",
    color: tema.texto3,
    fontSize: 13,
    fontWeight: "600",
    paddingVertical: 14,
  },
  section: { marginTop: 20, gap: 6 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  sectionContent: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  rowLabel: { color: "#888", flexShrink: 0 },
  rowValue: { color: "#111", textAlign: "right", flexShrink: 1 },

  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#eaeaea",
    marginHorizontal: 0,
  },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  personName: { color: "#111", flexShrink: 1 },
  personTipo: { color: "#888" },

  notasText: {
    color: "#222",
    paddingVertical: 12,
    lineHeight: 22,
  },

  mediaSection: { marginTop: 20, gap: 8 },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 4,
  },
  mediaTile: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  mediaTileImage: {
    width: "100%",
    height: "100%",
  },
  videoTile: {
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  videoLabel: { color: "#fff", fontWeight: "600" },
  playBadge: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBadgeIcon: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 2,
  },

  error: { textAlign: "center", marginTop: 16 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
    gap: 4,
  },
  primaryBtn: { borderRadius: 14 },
  primaryBtnContent: { paddingVertical: 8 },
  primaryBtnLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  secondaryBtn: { alignSelf: "center" },
  secondaryBtnLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  chatBtn: {
    borderRadius: 14,
    borderColor: tema.verde,
    marginTop: 4,
  },
  chatBtnLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: tema.verde,
  },
});
