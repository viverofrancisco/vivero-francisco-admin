import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Button, HelperText, Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import { apiRequest, ApiError } from "@/lib/api";
import type { VisitaDetail, VisitaMedia } from "@/lib/types";
import { listaProductos } from "@/lib/types";
import { MediaViewer, type MediaViewerSource } from "@/components/MediaViewer";

export default function ClienteVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [visita, setVisita] = useState<VisitaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoThumbs, setVideoThumbs] = useState<Record<string, string>>({});
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const v = await apiRequest<VisitaDetail>(`/api/mobile/visitas/${id}`);
      setVisita(v);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos cargar la visita");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
        // ignore
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visita, videoThumbs]);

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

  const personalAsignado = visita.personal ?? [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View
            style={[
              styles.estadoChip,
              { backgroundColor: estadoBg(visita.estado) },
            ]}
          >
            <View
              style={[
                styles.estadoDot,
                { backgroundColor: estadoColor(visita.estado) },
              ]}
            />
            <Text variant="bodySmall" style={styles.estadoLabel}>
              {estadoLabel(visita.estado)}
            </Text>
          </View>
          <Text variant="headlineSmall" style={styles.heroTitle}>
            {listaProductos(visita)}
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            {formatLongDate(visita.fechaProgramada)}
          </Text>
        </View>

        {/* Cuándo */}
        <Section title="Cuándo">
          <Row label="Programada" value={formatDate(visita.fechaProgramada)} />
          {visita.fechaRealizada ? (
            <Row label="Realizada" value={formatDate(visita.fechaRealizada)} />
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

        {/* Notas / Motivo */}
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

        {/* Archivos */}
        {visita.media && visita.media.length > 0 ? (
          <View style={styles.mediaSection}>
            <Text variant="labelMedium" style={styles.sectionLabel}>
              ARCHIVOS
            </Text>
            <View style={styles.mediaGrid}>
              {visita.media.map((m) => (
                <MediaTile
                  key={m.id}
                  item={m}
                  thumbUri={videoThumbs[m.id]}
                  onPress={() =>
                    setActiveMedia({ url: m.url, tipo: m.tipo })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        {error ? (
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={() => router.push(`/(cliente)/visitas/chat/${visita.id}`)}
          icon="message-outline"
          style={styles.primaryBtn}
          contentStyle={styles.primaryBtnContent}
          labelStyle={styles.primaryBtnLabel}
        >
          Mensajes
        </Button>
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

function MediaTile({
  item,
  thumbUri,
  onPress,
}: {
  item: VisitaMedia;
  thumbUri?: string;
  onPress: () => void;
}) {
  const isVideo = item.tipo === "video";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.mediaTile,
        pressed && { opacity: 0.7 },
      ]}
    >
      {isVideo ? (
        thumbUri ? (
          <>
            <Image source={{ uri: thumbUri }} style={styles.mediaTileImage} />
            <View style={styles.playBadge}>
              <Text style={styles.playBadgeIcon}>▶</Text>
            </View>
          </>
        ) : (
          <View style={[styles.mediaTileImage, styles.videoTile]}>
            <Text style={styles.videoLabel}>▶ Video</Text>
          </View>
        )
      ) : (
        <Image source={{ uri: item.url }} style={styles.mediaTileImage} />
      )}
    </Pressable>
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

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
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

function estadoBg(estado: string): string {
  switch (estado) {
    case "PROGRAMADA":
      return "#e8f5e9";
    case "COMPLETADA":
      return "#f0f0f0";
    case "INCOMPLETA":
      return "#fff3e0";
    case "CANCELADA":
      return "#ffebee";
    default:
      return "#f4f4f4";
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

  hero: {
    paddingVertical: 8,
    paddingBottom: 16,
    gap: 6,
  },
  heroTitle: { color: "#111", fontWeight: "700" },
  heroSubtitle: { color: "#777" },

  estadoChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
    marginBottom: 4,
  },
  estadoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  estadoLabel: {
    fontWeight: "500",
    color: "#222",
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
  },
  primaryBtn: { borderRadius: 14, backgroundColor: "#2e7d32" },
  primaryBtnContent: { paddingVertical: 8 },
  primaryBtnLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: "#fff",
  },
});
