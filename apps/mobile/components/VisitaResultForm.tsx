import { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  HelperText,
  IconButton,
  Text,
  TextInput,
} from "react-native-paper";
import { useRouter, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar, type DateData } from "react-native-calendars";
import { apiRequest, ApiError } from "@/lib/api";
import type { VisitaDetail, VisitaMedia } from "@/lib/types";

type Mode = "complete" | "incomplete";

interface MediaItem {
  uri: string;
  fileName: string;
  contentType: string;
  tipo: "imagen" | "video";
  thumbUri?: string;
}

export interface VisitaFormInitialValues {
  fechaRealizada?: string | null; // ISO date or YYYY-MM-DD
  horaEntrada?: string | null; // "HH:MM"
  horaSalida?: string | null;
  text?: string | null;
  existingMedia?: VisitaMedia[];
}

interface UploadDescriptor {
  key: string;
  uploadUrl: string;
  tipo: "imagen" | "video";
  contentType: string;
}

interface UploadsResponse {
  uploads: UploadDescriptor[];
}

export function VisitaResultForm({
  visitaId,
  mode,
  initialValues,
}: {
  visitaId: string;
  mode: Mode;
  initialValues?: VisitaFormInitialValues;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const initialFecha = useMemo(
    () =>
      initialValues?.fechaRealizada
        ? startOfDay(new Date(initialValues.fechaRealizada))
        : today,
    [initialValues?.fechaRealizada, today]
  );
  const [fecha, setFecha] = useState<Date>(initialFecha);
  const [showCalendar, setShowCalendar] = useState(false);

  const [horaEntrada, setHoraEntrada] = useState<Date | null>(
    parseHm(initialValues?.horaEntrada)
  );
  const [horaSalida, setHoraSalida] = useState<Date | null>(
    parseHm(initialValues?.horaSalida)
  );
  const [timePicker, setTimePicker] = useState<"entrada" | "salida" | null>(
    null
  );
  // Holds the picker value while the iOS spinner is open. We commit it on
  // "Listo" so a user can tap Listo without scrolling and still save the
  // initial time shown in the wheel.
  const [pendingTime, setPendingTime] = useState<Date | null>(null);

  function openTimePicker(which: "entrada" | "salida") {
    const current = which === "entrada" ? horaEntrada : horaSalida;
    setPendingTime(current ?? defaultTime());
    setTimePicker(which);
  }

  function commitTimePicker() {
    if (timePicker && pendingTime) {
      if (timePicker === "entrada") setHoraEntrada(pendingTime);
      else setHoraSalida(pendingTime);
    }
    setTimePicker(null);
    setPendingTime(null);
  }

  function cancelTimePicker() {
    setTimePicker(null);
    setPendingTime(null);
  }

  const [text, setText] = useState(initialValues?.text ?? "");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [existingMedia, setExistingMedia] = useState<VisitaMedia[]>(
    initialValues?.existingMedia ?? []
  );
  const [removingMediaIds, setRemovingMediaIds] = useState<Set<string>>(
    new Set()
  );
  const [existingVideoThumbs, setExistingVideoThumbs] = useState<
    Record<string, string>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = (initialValues?.existingMedia?.length ?? 0) > 0
    || initialValues?.text !== undefined
    || initialValues?.fechaRealizada !== undefined;
  const isComplete = mode === "complete";
  const headerTitle = isEdit
    ? (isComplete ? "Editar visita" : "Editar visita")
    : (isComplete ? "Completar visita" : "Marcar incompleta");
  const submitLabel = isEdit
    ? "Guardar cambios"
    : isComplete
      ? "Marcar completada"
      : "Marcar incompleta";
  const textLabel = isComplete ? "Notas (opcional)" : "Motivo";
  const canSubmit = isComplete ? true : text.trim().length > 0;

  // Generate thumbnails for existing remote videos so they appear with a
  // preview frame instead of the dark placeholder.
  useEffect(() => {
    const videos = existingMedia.filter((m) => m.tipo === "video");
    let cancelled = false;
    videos.forEach(async (m) => {
      if (existingVideoThumbs[m.id]) return;
      try {
        const thumb = await VideoThumbnails.getThumbnailAsync(m.url, {
          time: 1000,
          quality: 0.6,
        });
        if (!cancelled) {
          setExistingVideoThumbs((prev) => ({ ...prev, [m.id]: thumb.uri }));
        }
      } catch {
        // Leave fallback placeholder.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [existingMedia, existingVideoThumbs]);

  async function removeExisting(media: VisitaMedia) {
    if (removingMediaIds.has(media.id)) return;
    setRemovingMediaIds((prev) => new Set(prev).add(media.id));
    try {
      await apiRequest<void>(
        `/api/mobile/visitas/${visitaId}/media/${media.id}`,
        { method: "DELETE" }
      );
      setExistingMedia((prev) => prev.filter((m) => m.id !== media.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos eliminar el archivo.");
    } finally {
      setRemovingMediaIds((prev) => {
        const next = new Set(prev);
        next.delete(media.id);
        return next;
      });
    }
  }

  async function pickMedia() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Permite el acceso a tus fotos para subir imágenes o videos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 20,
    });
    if (result.canceled) return;
    const additions: MediaItem[] = await Promise.all(
      result.assets.map(async (a) => {
        const uri = a.uri;
        const inferredName =
          a.fileName ?? uri.split("/").pop() ?? `media-${Date.now()}`;
        const isVideo = a.type === "video";
        const contentType = guessContentType(inferredName, isVideo);
        let thumbUri: string | undefined;
        if (isVideo) {
          try {
            const thumb = await VideoThumbnails.getThumbnailAsync(uri, {
              time: 1000,
              quality: 0.6,
            });
            thumbUri = thumb.uri;
          } catch {
            // Fall back to no thumbnail; render placeholder.
          }
        }
        return {
          uri,
          fileName: inferredName,
          contentType,
          tipo: isVideo ? "video" : "imagen",
          thumbUri,
        };
      })
    );
    setMedia((prev) => [...prev, ...additions].slice(0, 20));
  }

  function removeMedia(uri: string) {
    setMedia((prev) => prev.filter((m) => m.uri !== uri));
  }

  async function uploadAll(): Promise<{ key: string; tipo: "imagen" | "video" }[]> {
    if (media.length === 0) return [];
    const presign = await apiRequest<UploadsResponse>(
      `/api/mobile/visitas/${visitaId}/media`,
      {
        method: "POST",
        body: {
          files: media.map((m) => ({
            fileName: m.fileName,
            contentType: m.contentType,
          })),
        },
      }
    );
    if (presign.uploads.length !== media.length) {
      throw new Error("Respuesta inválida del servidor de carga.");
    }
    await Promise.all(
      media.map(async (m, i) => {
        const upload = presign.uploads[i];
        const fileRes = await fetch(m.uri);
        const blob = await fileRes.blob();
        const putRes = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": upload.contentType },
          body: blob,
        });
        if (!putRes.ok) {
          throw new Error("No pudimos subir uno de los archivos.");
        }
      })
    );
    return presign.uploads.map((u) => ({ key: u.key, tipo: u.tipo }));
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const uploaded = await uploadAll();
      const fechaRealizada = formatYmd(fecha);
      const payload = {
        fechaRealizada,
        horaEntrada: horaEntrada ? formatHm(horaEntrada) : undefined,
        horaSalida: horaSalida ? formatHm(horaSalida) : undefined,
        media: uploaded,
        ...(isComplete
          ? { notes: text.trim() || undefined }
          : { reason: text.trim() }),
      };
      await apiRequest<VisitaDetail>(
        `/api/mobile/visitas/${visitaId}/${isComplete ? "complete" : "incomplete"}`,
        { method: "POST", body: payload }
      );
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.flex}>
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <View style={styles.headerRow}>
            <IconButton
              icon="close"
              size={24}
              onPress={() => router.back()}
              style={styles.headerBtn}
            />
            <Text variant="titleMedium" style={styles.headerTitle}>
              {headerTitle}
            </Text>
            <View style={styles.headerBtn} />
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Section title="Fecha">
            <Pressable
              onPress={() => setShowCalendar(true)}
              style={({ pressed }) => [
                styles.fieldBox,
                pressed && styles.fieldBoxPressed,
              ]}
            >
              <Text variant="bodyMedium" style={styles.fieldValue}>
                {formatLongDate(fecha)}
              </Text>
            </Pressable>
          </Section>

          <Section title="Horario">
            <View style={styles.timeRow}>
              <TimePickField
                label="Entrada"
                value={horaEntrada}
                onPress={() => openTimePicker("entrada")}
                onClear={() => setHoraEntrada(null)}
              />
              <TimePickField
                label="Salida"
                value={horaSalida}
                onPress={() => openTimePicker("salida")}
                onClear={() => setHoraSalida(null)}
              />
            </View>
          </Section>

          <Section title={isComplete ? "Notas" : "Motivo"}>
            <TextInput
              mode="outlined"
              value={text}
              onChangeText={setText}
              label={textLabel}
              multiline
              numberOfLines={4}
              outlineColor="#e0e0e0"
              activeOutlineColor="#2e7d32"
              outlineStyle={{ borderRadius: 12 }}
              style={styles.textInput}
            />
          </Section>

          <Section title="Imágenes y videos">
            <View style={styles.mediaGrid}>
              {existingMedia.map((m) => {
                const removing = removingMediaIds.has(m.id);
                const isVideo = m.tipo === "video";
                const thumb = isVideo ? existingVideoThumbs[m.id] : undefined;
                return (
                  <View
                    key={m.id}
                    style={[styles.mediaItem, removing && { opacity: 0.4 }]}
                  >
                    {!isVideo ? (
                      <Image source={{ uri: m.url }} style={styles.mediaThumb} />
                    ) : thumb ? (
                      <>
                        <Image source={{ uri: thumb }} style={styles.mediaThumb} />
                        <View style={styles.playBadge}>
                          <Text style={styles.playBadgeIcon}>▶</Text>
                        </View>
                      </>
                    ) : (
                      <View style={[styles.mediaThumb, styles.videoThumb]}>
                        <Text style={styles.videoLabel}>Video</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => removeExisting(m)}
                      style={styles.mediaRemove}
                      hitSlop={8}
                      disabled={removing}
                    >
                      <Text style={styles.mediaRemoveX}>×</Text>
                    </Pressable>
                  </View>
                );
              })}
              {media.map((m) => (
                <View key={m.uri} style={styles.mediaItem}>
                  {m.tipo === "imagen" ? (
                    <Image source={{ uri: m.uri }} style={styles.mediaThumb} />
                  ) : m.thumbUri ? (
                    <>
                      <Image
                        source={{ uri: m.thumbUri }}
                        style={styles.mediaThumb}
                      />
                      <View style={styles.playBadge}>
                        <Text style={styles.playBadgeIcon}>▶</Text>
                      </View>
                    </>
                  ) : (
                    <View style={[styles.mediaThumb, styles.videoThumb]}>
                      <Text style={styles.videoLabel}>Video</Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => removeMedia(m.uri)}
                    style={styles.mediaRemove}
                    hitSlop={8}
                  >
                    <Text style={styles.mediaRemoveX}>×</Text>
                  </Pressable>
                </View>
              ))}
              {existingMedia.length + media.length < 20 ? (
                <Pressable
                  onPress={pickMedia}
                  style={({ pressed }) => [
                    styles.mediaAdd,
                    pressed && styles.mediaAddPressed,
                  ]}
                >
                  <Text style={styles.mediaAddPlus}>+</Text>
                  <Text style={styles.mediaAddLabel}>Agregar</Text>
                </Pressable>
              ) : null}
            </View>
          </Section>

          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button
            mode="contained"
            onPress={submit}
            loading={submitting}
            disabled={submitting || !canSubmit}
            buttonColor={isComplete ? "#2e7d32" : "#c62828"}
            textColor="#fff"
            style={styles.primaryBtn}
            contentStyle={styles.primaryBtnContent}
            labelStyle={styles.primaryBtnLabel}
          >
            {submitLabel}
          </Button>
        </View>
      </View>

      {/* Date modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowCalendar(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Calendar
              current={formatYmd(fecha)}
              onDayPress={(d: DateData) => {
                const next = new Date(d.year, d.month - 1, d.day);
                setFecha(next);
                setShowCalendar(false);
              }}
              markedDates={{
                [formatYmd(fecha)]: {
                  selected: true,
                  selectedColor: "#2e7d32",
                },
              }}
              theme={{
                todayTextColor: "#2e7d32",
                arrowColor: "#2e7d32",
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Time picker — Android shows a native dialog; iOS renders inline so
          we wrap it in a bottom-sheet Modal to float it above the footer. */}
      {Platform.OS === "ios" ? (
        <Modal
          visible={timePicker !== null}
          transparent
          animationType="fade"
          onRequestClose={cancelTimePicker}
        >
          <Pressable style={styles.timeBackdrop} onPress={cancelTimePicker}>
            <Pressable
              style={styles.timeSheet}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.timeSheetHeader}>
                <Button
                  mode="text"
                  textColor="#2e7d32"
                  onPress={commitTimePicker}
                >
                  Listo
                </Button>
              </View>
              {timePicker !== null ? (
                <DateTimePicker
                  mode="time"
                  display="spinner"
                  value={pendingTime ?? defaultTime()}
                  onChange={(_event, selected) => {
                    if (selected) setPendingTime(selected);
                  }}
                />
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
      ) : timePicker !== null ? (
        <DateTimePicker
          mode="time"
          display="default"
          value={
            (timePicker === "entrada" ? horaEntrada : horaSalida) ??
            defaultTime()
          }
          onChange={(_event, selected) => {
            setTimePicker(null);
            if (selected) {
              if (timePicker === "entrada") setHoraEntrada(selected);
              else setHoraSalida(selected);
            }
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function TimePickField({
  label,
  value,
  onPress,
  onClear,
}: {
  label: string;
  value: Date | null;
  onPress: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.timeFieldWrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.fieldBox,
          styles.timeField,
          pressed && styles.fieldBoxPressed,
        ]}
      >
        <Text variant="labelSmall" style={styles.timeFieldLabel}>
          {label.toUpperCase()}
        </Text>
        <Text variant="bodyLarge" style={styles.timeFieldValue}>
          {value ? formatHm(value) : "—"}
        </Text>
      </Pressable>
      {value ? (
        <Pressable onPress={onClear} hitSlop={8} style={styles.timeClear}>
          <Text style={styles.timeClearX}>×</Text>
        </Pressable>
      ) : null}
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
  return (
    <View style={styles.section}>
      <Text variant="labelMedium" style={styles.sectionLabel}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseHm(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function defaultTime(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatHm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function guessContentType(name: string, isVideo: boolean): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (isVideo) {
    if (ext === "mov") return "video/quicktime";
    if (ext === "m4v") return "video/x-m4v";
    return "video/mp4";
  }
  if (ext === "png") return "image/png";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 20 },

  header: {
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  headerBtn: { margin: 0, width: 40 },
  headerTitle: { color: "#111", fontWeight: "600" },

  section: { gap: 8 },
  sectionLabel: {
    color: "#888",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingLeft: 4,
  },

  fieldBox: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  fieldBoxPressed: { backgroundColor: "#f0f0f0" },
  fieldValue: { color: "#111" },

  timeRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeFieldWrap: { flex: 1, position: "relative" },
  timeField: {
    paddingVertical: 10,
    gap: 2,
  },
  timeFieldLabel: {
    color: "#888",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  timeFieldValue: {
    color: "#111",
    fontWeight: "500",
  },
  timeClear: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  timeClearX: { color: "#555", fontSize: 14, lineHeight: 16 },

  textInput: {
    backgroundColor: "#fff",
    minHeight: 96,
  },

  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  mediaItem: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#f0f0f0",
  },
  mediaThumb: {
    width: "100%",
    height: "100%",
  },
  videoThumb: {
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
  mediaRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaRemoveX: { color: "#fff", fontSize: 16, lineHeight: 18 },
  mediaAdd: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#bbb",
    backgroundColor: "#fafafa",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  mediaAddPressed: { backgroundColor: "#f0f0f0" },
  mediaAddPlus: { fontSize: 28, color: "#2e7d32", lineHeight: 30 },
  mediaAddLabel: { color: "#666", fontSize: 12 },

  error: { textAlign: "center", marginTop: 4 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },

  timeBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  timeSheet: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingBottom: 8,
    overflow: "hidden",
  },
  timeSheetHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
});

