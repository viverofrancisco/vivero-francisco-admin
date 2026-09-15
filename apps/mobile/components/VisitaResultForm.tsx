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
} from "react-native-paper";
import { useRouter, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiRequest, ApiError } from "@/lib/api";
import type {
  VisitaDetail,
  VisitaMedia,
} from "@/lib/types";

/**
 * El parte de una persona: sus horas y las tareas que **ella** hizo.
 *
 * Reemplaza al viejo formulario de "completar visita". Cerrar la visita pasó a
 * ser de oficina —decir que el trabajo está terminado es mirar lo que cargaron
 * todos— así que desde el teléfono lo único que se hace es contar lo propio.
 *
 * Tampoco pide la fecha: la visita ya tiene la suya, y qué día se da por hecha
 * lo decide quien la cierra.
 */

interface MediaItem {
  uri: string;
  fileName: string;
  contentType: string;
  tipo: "imagen" | "video";
  thumbUri?: string;
  /// A qué tarea corresponde. Es lo que hace que caiga sola en su sección del
  /// informe, así que se pregunta acá: es el único momento en que alguien se
  /// acuerda de qué era cada foto.
  tareaId: string | null;
}

/** Una tarea del catálogo, tal como la devuelve `/api/mobile/tareas`. */
export interface TareaDeCatalogo {
  id: string;
  nombre: string;
  orden: number;
}

export interface VisitaFormInitialValues {
  horaEntrada?: string | null; // "HH:MM"
  horaSalida?: string | null;
  /** Las tareas que esta persona ya tenía cargadas. */
  tareaIds?: string[];
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
  initialValues,
  tareas,
  obligatorias = [],
}: {
  visitaId: string;
  initialValues?: VisitaFormInitialValues;
  /** El catálogo entero: se marca de acá lo que se hizo. */
  tareas: TareaDeCatalogo[];
  /** Las que la visita exige, para ponerlas primero y señalarlas. */
  obligatorias?: string[];
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  /** Lo que esta persona hizo. Es el estado final: reemplaza lo que tuviera. */
  const [tareaIds, setTareaIds] = useState<string[]>(
    initialValues?.tareaIds ?? []
  );
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

  const isEdit = (initialValues?.tareaIds?.length ?? 0) > 0;
  const headerTitle = isEdit ? "Editar mi parte" : "¿Qué hiciste?";
  const submitLabel = isEdit ? "Guardar cambios" : "Guardar mi parte";
  // Se puede guardar sin marcar nada: hay días en que se fue y no se hizo lo
  // que estaba previsto, y eso también es información.
  const canSubmit = true;

  /**
   * Las obligatorias primero. Es lo que hay que dejar hecho, así que tenerlas
   * que buscar en una lista de veinte es esconder justo lo que importa.
   */
  const enOrden = useMemo(() => {
    const exigidas = new Set(obligatorias);
    return [...tareas].sort((a, b) => {
      const pa = exigidas.has(a.id) ? 0 : 1;
      const pb = exigidas.has(b.id) ? 0 : 1;
      return pa - pb || a.orden - b.orden;
    });
  }, [tareas, obligatorias]);

  const alternarTarea = (id: string) =>
    setTareaIds((prev) => {
      const siguiente = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      // El selector sigue a lo marcado: desmarcar la tarea con la que se
      // estaban etiquetando fotos lo dejaría apuntando a algo que ya no se hizo,
      // y marcar la primera da una etiqueta por omisión sin pedir nada.
      if (!etiqueta || !siguiente.includes(etiqueta)) {
        setEtiqueta(siguiente[0] ?? null);
      }
      return siguiente;
    });

  /**
   * Con qué tarea entran las fotos nuevas.
   *
   * Sale de las que la persona acaba de marcar, no del catálogo entero:
   * etiquetar una foto con algo que no hizo no tiene sentido, y una lista de
   * veinte donde solo tres aplican es una lista que nadie usa. Con una sola
   * marcada va puesta y el selector ni aparece.
   */
  const [etiqueta, setEtiqueta] = useState<string | null>(
    initialValues?.tareaIds?.[0] ?? null
  );
  const etiquetables = tareas.filter((t) => tareaIds.includes(t.id));
  const nombreDeTarea = (id: string | null) =>
    id ? (tareas.find((t) => t.id === id)?.nombre ?? null) : null;

  /** Rota la etiqueta de una foto ya agregada entre lo marcado y "sin etiqueta". */
  function rotarEtiqueta(uri: string) {
    if (etiquetables.length === 0) return;
    const ids: (string | null)[] = [...etiquetables.map((t) => t.id), null];
    setMedia((prev) =>
      prev.map((m) =>
        m.uri === uri
          ? { ...m, tareaId: ids[(ids.indexOf(m.tareaId) + 1) % ids.length] }
          : m
      )
    );
  }

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
          // Entra con la tarea que esté activa en el selector de abajo. Con
          // una sola marcada no hay nada que elegir y va puesta.
          tareaId: etiqueta,
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
    return presign.uploads.map((u, i) => ({
      key: u.key,
      tipo: u.tipo,
      tareaId: media[i]?.tareaId ?? null,
    }));
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const uploaded = await uploadAll();
      await apiRequest<VisitaDetail>(`/api/mobile/visitas/${visitaId}/parte`, {
        method: "POST",
        body: {
          horaEntrada: horaEntrada ? formatHm(horaEntrada) : null,
          horaSalida: horaSalida ? formatHm(horaSalida) : null,
          tareaIds,
          media: uploaded,
        },
      });
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

          {/* Lo que hiciste **tú**. Otro puede haber hecho otras cosas en la
              misma visita y las carga en su propio parte. */}
          <Section title="Tareas que hiciste">
            <View style={styles.tareas}>
              {enOrden.map((t) => {
                const marcada = tareaIds.includes(t.id);
                const exigida = obligatorias.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => alternarTarea(t.id)}
                    style={[styles.tarea, marcada && styles.tareaMarcada]}
                  >
                    <View
                      style={[styles.casilla, marcada && styles.casillaMarcada]}
                    >
                      {marcada ? <Text style={styles.tilde}>✓</Text> : null}
                    </View>
                    <Text
                      style={[
                        styles.tareaTexto,
                        marcada && styles.tareaTextoMarcada,
                      ]}
                    >
                      {t.nombre}
                    </Text>
                    {exigida ? (
                      <Text style={styles.obligatoria}>Obligatoria</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section title="Imágenes y videos">
            {/* Con qué tarea entran las fotos nuevas. Solo entre las que se
                acaban de marcar: etiquetar una foto con algo que no se hizo no
                tiene sentido. Con una sola no hay nada que elegir. */}
            {etiquetables.length > 1 ? (
              <View style={styles.tagPicker}>
                <Text style={styles.tagPickerLabel}>
                  Las fotos nuevas son de:
                </Text>
                <View style={styles.tagChips}>
                  {etiquetables.map((t) => {
                    const activo = etiqueta === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setEtiqueta(t.id)}
                        style={[styles.tagChip, activo && styles.tagChipActive]}
                      >
                        <Text
                          style={[
                            styles.tagChipText,
                            activo && styles.tagChipTextActive,
                          ]}
                        >
                          {t.nombre}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => setEtiqueta(null)}
                    style={[
                      styles.tagChip,
                      etiqueta === null && styles.tagChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        etiqueta === null && styles.tagChipTextActive,
                      ]}
                    >
                      Sin etiqueta
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.tagPickerHint}>
                  Así cada foto cae sola en su sección del informe. Toca la
                  etiqueta de una foto para cambiarla.
                </Text>
              </View>
            ) : null}
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
                  {etiquetables.length > 1 ? (
                    <Pressable
                      onPress={() => rotarEtiqueta(m.uri)}
                      style={styles.mediaTag}
                      hitSlop={4}
                    >
                      <Text style={styles.mediaTagText} numberOfLines={1}>
                        {nombreDeTarea(m.tareaId) ?? "Sin etiqueta"}
                      </Text>
                    </Pressable>
                  ) : null}
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
            buttonColor="#2e7d32"
            textColor="#fff"
            style={styles.primaryBtn}
            contentStyle={styles.primaryBtnContent}
            labelStyle={styles.primaryBtnLabel}
          >
            {submitLabel}
          </Button>
        </View>
      </View>

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

function formatHm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
  tareas: {
    gap: 8,
  },
  tarea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  tareaMarcada: {
    borderColor: "#2e7d32",
    backgroundColor: "#f1f8f2",
  },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#bdbdbd",
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: {
    borderColor: "#2e7d32",
    backgroundColor: "#2e7d32",
  },
  tilde: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  tareaTexto: {
    flex: 1,
    fontSize: 15,
    color: "#212121",
  },
  tareaTextoMarcada: {
    fontWeight: "600",
  },
  obligatoria: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b26a00",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tagPicker: {
    marginBottom: 12,
    gap: 6,
  },
  tagPickerLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  tagChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  tagChipActive: {
    borderColor: "#2e7d32",
    backgroundColor: "#e8f5e9",
  },
  tagChipText: {
    fontSize: 12,
    color: "#666",
  },
  tagChipTextActive: {
    color: "#2e7d32",
    fontWeight: "600",
  },
  tagPickerHint: {
    fontSize: 11,
    color: "#888",
    lineHeight: 15,
  },
  mediaTag: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingVertical: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  mediaTagText: {
    color: "#fff",
    fontSize: 9,
    textAlign: "center",
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

