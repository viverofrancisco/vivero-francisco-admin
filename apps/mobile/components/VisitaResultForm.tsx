import { useEffect, useMemo, useState } from "react";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  KeyboardAvoidingView,
  Platform,
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
import { apiRequest, ApiError } from "@/lib/api";
import { dispositivoId } from "@/lib/dispositivo";
import { avisarFaltaUbicacion, type ResultadoUbicacion } from "@/lib/ubicacion";
import * as Haptics from "expo-haptics";
import type {
  VisitaDetail,
  VisitaMedia,
} from "@/lib/types";
import { tema } from "@/lib/tema";

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


/** Una tarea del catálogo, tal como la devuelve `/api/mobile/tareas`. */
export interface TareaDeCatalogo {
  id: string;
  nombre: string;
  orden: number;
}

export interface VisitaFormInitialValues {

  /** Las tareas que esta persona ya tenía cargadas. */
  tareaIds?: string[];
  existingMedia?: VisitaMedia[];
}



export function VisitaResultForm({
  visitaId,
  initialValues,
  tareas,
  obligatorias = [],
  modo,
  ubicacion,
}: {
  visitaId: string;
  initialValues?: VisitaFormInitialValues;
  /** El catálogo entero: se marca de acá lo que se hizo. */
  tareas: TareaDeCatalogo[];
  /** Las que la visita exige, para ponerlas primero y señalarlas. */
  obligatorias?: string[];
  /**
   * Qué está pasando al guardar.
   *
   * `SALIDA` es el gesto de irse: sella el momento y guarda lo que hizo, todo
   * junto. `CORRECCION` es volver después a arreglar lo que marcó, y no toca
   * las marcas — la hora a la que se fue ya pasó.
   */
  modo: "SALIDA" | "CORRECCION";
  /** Se lee al apretar, no acá: quien llama decide cuándo pedirla. */
  ubicacion?: () => Promise<ResultadoUbicacion>;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);



  /** Lo que esta persona hizo. Es el estado final: reemplaza lo que tuviera. */
  const [tareaIds, setTareaIds] = useState<string[]>(
    initialValues?.tareaIds ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerTitle = modo === "SALIDA" ? "¿Qué hiciste?" : "Mi parte";
  const submitLabel = modo === "SALIDA" ? "Marcar salida" : "Guardar cambios";
  // Al menos una tarea. Un parte sin ninguna no dice nada —ni para el informe,
  // que ubica las fotos por tarea, ni para la oficina, que mira qué se cubrió—
  // y salir sin marcar era el camino más corto, así que era el que se tomaba.
  // Corregir un parte vacío queda del lado de la oficina, que puede.
  const canSubmit = tareaIds.length > 0;

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
    setTareaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );








  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Sin permiso no se marca la salida tampoco: es la misma decisión, y
      // exigirla solo al entrar la volvería opcional en la práctica. Sin señal
      // sí se marca — ver `ubicacionActual`.
      const donde = modo === "SALIDA" && ubicacion ? await ubicacion() : null;
      if (donde?.estado === "sin-permiso") {
        setSubmitting(false);
        avisarFaltaUbicacion(
          "Para marcar tu salida necesitamos saber dónde estás.",
          donde.ajustes
        );
        return;
      }

      if (modo === "SALIDA") {
        // Irse es un solo gesto: sella el momento, guarda lo que hizo y sube
        // lo que sacó.
        await apiRequest<VisitaDetail>(`/api/mobile/visitas/${visitaId}/marca`, {
          method: "POST",
          body: {
            tipo: "SALIDA",
            ubicacion: donde?.estado === "ok" ? donde.ubicacion : null,
            dispositivo: await dispositivoId(),
            tareaIds,
          },
        });
      } else {
        // Corregir no mueve las marcas: la hora a la que se fue ya pasó.
        await apiRequest<VisitaDetail>(`/api/mobile/visitas/${visitaId}/parte`, {
          method: "POST",
          body: { tareaIds },
        });
      }
      // Sella la hora de salida y guarda lo que hizo. Se iba con un
      // `router.back()` y ningún acuse de recibo.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
        {/* Sin `insets.top`: la pantalla se presenta como modal, así que ya
            arranca debajo de la barra de estado y sumarlo dejaba un hueco
            blanco del alto de la barra arriba del título. */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {/* El espaciador a la izquierda y la ✕ a la derecha: el título
                queda centrado igual, y cerrar cae del lado del pulgar. */}
            <View style={styles.headerBtn} />
            <Text variant="titleMedium" style={styles.headerTitle}>
              {headerTitle}
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => router.back()}
              style={styles.headerBtn}
            />
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Lo que hiciste **tú**. Otro puede haber hecho otras cosas en la
              misma visita y las carga en su propio parte. Sin rótulo: el
              título de la pantalla ya pregunta qué hiciste. */}
          <View style={styles.tareas}>
            {enOrden.map((t) => {
              const marcada = tareaIds.includes(t.id);
              const exigida = obligatorias.includes(t.id);
              return (
                <PressableScale
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
                </PressableScale>
              );
            })}
          </View>

          {error ? (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {tareaIds.length === 0 ? (
            <Text style={styles.pista}>Marca al menos una tarea.</Text>
          ) : null}
          <Button
            mode="contained"
            onPress={submit}
            loading={submitting}
            disabled={submitting || !canSubmit}
            buttonColor={tema.verde}
            textColor="#fff"
            style={styles.primaryBtn}
            contentStyle={styles.primaryBtnContent}
            labelStyle={styles.primaryBtnLabel}
          >
            {submitLabel}
          </Button>
        </View>
      </View>

    </KeyboardAvoidingView>
  );
}







const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 20 },

  header: {
    // La hoja arranca pegada al borde de la pantalla: sin esto el título
    // toca el filo redondeado del modal.
    paddingTop: 10,
    paddingBottom: 10,
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
    borderColor: tema.verde,
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
    borderColor: tema.verde,
    backgroundColor: tema.verde,
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

  error: { textAlign: "center", marginTop: 4 },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#eee",
    gap: 4,
  },
  pista: { color: tema.texto3, fontSize: 13, textAlign: "center" },
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

