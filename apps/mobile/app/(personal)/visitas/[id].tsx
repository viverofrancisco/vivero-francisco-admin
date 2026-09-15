import React, { useCallback, useEffect, useState } from "react";
import { estadoLabel, estadoPildora } from "@/lib/estado-visita";
import { Alert, Linking, ScrollView, StyleSheet, View } from "react-native";
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
import { tareasHechas } from "@/lib/types";
import { useAuthStore } from "@/lib/auth-store";
import { MediaViewer, type MediaViewerSource } from "@/components/MediaViewer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";
import { hora12 } from "@/lib/hora";
import { DialogoConfirmar } from "@/components/ui/DialogoConfirmar";
import { ubicacionActual } from "@/lib/ubicacion";
import { dispositivoId } from "@/lib/dispositivo";
import * as Haptics from "expo-haptics";

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
  const [confirmandoEntrada, setConfirmandoEntrada] = useState(false);
  const [marcando, setMarcando] = useState(false);
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
  /**
   * Marcar entrada, desde la ficha.
   *
   * Era una pantalla completa con un título, un renglón y un botón. Una
   * pantalla es para algo que se llena; esto es una decisión de sí o no.
   */
  async function marcarEntrada() {
    setMarcando(true);
    try {
      // Sin permiso no se marca. Es lo único de todo esto que la persona
      // decide, así que es lo único que tiene sentido exigir; sin señal sí se
      // marca — ver `ubicacionActual`.
      const donde = await ubicacionActual();
      if (donde.estado === "sin-permiso") {
        setMarcando(false);
        setConfirmandoEntrada(false);
        Alert.alert(
          "Falta la ubicación",
          donde.ajustes
            ? "Para marcar tu entrada, activá la ubicación en Ajustes. Queda registrado desde dónde marcaste."
            : "Para marcar tu entrada necesitamos saber dónde estás.",
          donde.ajustes
            ? [
                { text: "Cancelar", style: "cancel" },
                { text: "Abrir Ajustes", onPress: () => Linking.openSettings() },
              ]
            : [{ text: "Entendido" }]
        );
        return;
      }

      await apiRequest(`/api/mobile/visitas/${visita!.id}/marca`, {
        method: "POST",
        body: {
          tipo: "ENTRADA",
          ubicacion: donde.estado === "ok" ? donde.ubicacion : null,
          dispositivo: await dispositivoId(),
        },
      });
      // En el mismo momento que el dato queda guardado, no cuando termina de
      // dibujarse: una háptica que llega tarde se lee como una falla.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmandoEntrada(false);
      // Sin señal se marcó igual, pero se avisa: quien marcó es el único que
      // puede salir al patio y volver a intentarlo la próxima.
      if (donde.estado === "sin-senal") {
        Alert.alert(
          "Entrada marcada",
          "No pudimos obtener tu ubicación, así que quedó registrada sin ella."
        );
      }
      await load();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof ApiError ? e.message : "No pudimos marcar");
      setConfirmandoEntrada(false);
    } finally {
      setMarcando(false);
    }
  }

  const cliente = visita.cliente;
  const personalAsignado = visita.personal ?? [];
  const filasDeTareas = armarFilasDeTareas(visita);

  return (
    <View style={styles.container}>
      {/* La flecha a la izquierda del nombre, y **fija**: adentro del scroll
          se iba pasando por debajo de la hora y la señal, que están encima de
          todo, y con ella se iba el modo de volver. Debajo del nombre va el
          estado, que era una fila más de Cuándo y es lo primero que se
          pregunta al abrir una visita. Las tareas, que estaban acá en una
          línea recortada, tienen su propia sección. */}
      <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
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
          <View
            style={[
              styles.pildora,
              { backgroundColor: estadoPildora(visita.estado).fondo },
            ]}
          >
            <Text
              style={[
                styles.pildoraTexto,
                { color: estadoPildora(visita.estado).color },
              ]}
            >
              {estadoLabel(visita.estado)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Cuándo */}
        <Section title="Cuándo">
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
              value={hora12(visita.horaEntrada)}
            />
          ) : null}
          {visita.horaSalida ? (
            <Row label="Hora de salida" value={hora12(visita.horaSalida)} />
          ) : null}
        </Section>

        {/* Lo que se registró: la unión de lo que cargó cada uno. Las
            obligatorias que nadie marcó aparecen igual, en gris: la pregunta
            que se hace acá es qué falta. */}
        <Section title="Tareas">
          {filasDeTareas.length > 0 ? (
            filasDeTareas.map((f) => (
              <View key={f.id} style={styles.tareaRow}>
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.tareaNombre,
                    f.pendiente && styles.tareaPendiente,
                  ]}
                >
                  {f.nombre}
                </Text>
                <Text variant="bodySmall" style={styles.tareaQuien}>
                  {f.detalle}
                </Text>
              </View>
            ))
          ) : (
            <Text variant="bodySmall" style={styles.tareasVacio}>
              Todavía no hay tareas registradas. Cada quien carga las suyas al
              marcar su salida.
            </Text>
          )}
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
              onVer={setActiveMedia}
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
              accion === "Marcar entrada"
                ? setConfirmandoEntrada(true)
                : router.push(`/(personal)/visitas/completar/${visita.id}`)
            }
            style={styles.primaryBtn}
            contentStyle={styles.primaryBtnContent}
            labelStyle={styles.primaryBtnLabel}
          >
            {accion}
          </Button>
        ) : null}
      </View>

      <DialogoConfirmar
        visible={confirmandoEntrada}
        titulo="¿Marcar tu entrada?"
        hora
        confirmar="Marcar entrada"
        cargando={marcando}
        onConfirmar={marcarEntrada}
        onCancelar={() => setConfirmandoEntrada(false)}
      />

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


/**
 * Qué se hizo y quién lo hizo, más lo que se pidió y nadie marcó.
 *
 * El nombre de pila alcanza para saber a quién preguntarle; el apellido
 * completo empuja la fila a dos líneas en la mitad de los casos.
 */
function armarFilasDeTareas(visita: VisitaDetail) {
  const quienes = new Map<string, string[]>();
  for (const p of visita.personal ?? []) {
    for (const { tarea } of p.tareas) {
      const lista = quienes.get(tarea.id) ?? [];
      lista.push(p.personal.nombre.split(" ")[0]);
      quienes.set(tarea.id, lista);
    }
  }

  const filas = tareasHechas(visita).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    detalle: (quienes.get(t.id) ?? []).join(", "),
    pendiente: false,
  }));

  for (const { tarea } of visita.tareasObligatorias ?? []) {
    if (quienes.has(tarea.id)) continue;
    filas.push({
      id: tarea.id,
      nombre: tarea.nombre,
      detalle: "Pendiente",
      pendiente: true,
    });
  }
  return filas;
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
  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
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
  pildora: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pildoraTexto: { fontSize: 12, fontWeight: "700", letterSpacing: 0.1 },


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

  tareaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  tareaNombre: { color: "#111", flexShrink: 1 },
  tareaPendiente: { color: "#888" },
  tareaQuien: { color: "#888", textAlign: "right", flexShrink: 0 },
  tareasVacio: { color: "#888", paddingVertical: 12, lineHeight: 19 },

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
    paddingTop: 10,
    // Poco: abajo está la barra de pestañas, que ya trae su propio margen.
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
    gap: 4,
  },
  primaryBtn: { borderRadius: 14 },
  primaryBtnContent: { height: 46 },
  primaryBtnLabel: {
    fontSize: 15,
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
