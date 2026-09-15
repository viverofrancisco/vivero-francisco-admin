import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { HojaInferior } from "@/components/ui/HojaInferior";
import { PressableScale } from "@/components/ui/PressableScale";
import { apiRequest, ApiError } from "@/lib/api";
import type { VisitaMedia } from "@/lib/types";
import type { TareaDeCatalogo } from "@/components/VisitaResultForm";

/**
 * Las fotos de la visita: las **propias**, en cualquier momento.
 *
 * Estaban dentro del formulario de salida, y ahí llegaban tarde: la foto se
 * saca **mientras** se trabaja —antes y después de podar, el riego roto que
 * apareció— y guardarla para el final es pedirle a alguien que se acuerde.
 *
 * Cada uno ve y toca las suyas. En una visita de tres, la grilla mezclaba el
 * trabajo de todos y cualquiera podía borrar la foto que otro acababa de sacar.
 * La oficina las ve todas, porque arma el informe, y el cliente también, porque
 * son de su jardín.
 *
 * **Nada se guarda hasta confirmar.** Agregar y quitar son cambios locales, y
 * una barra ofrece *Cancelar* / *Guardar*: así se sacan cinco de una en vez de
 * cinco llamadas, se pueden agregar y quitar en el mismo gesto, y hay dónde
 * arrepentirse. Se guarda todo junto o no se guarda nada.
 *
 * **La tarea es obligatoria** y va por foto, no por tanda: una pasada por la
 * galería trae la poda y el riego mezclados, así que una etiqueta para todo
 * sería mentira la mitad de las veces. Una foto sin tarea es la que el informe
 * no puede ubicar.
 */

/** Una foto elegida que todavía no se subió. */
interface Nueva {
  asset: ImagePicker.ImagePickerAsset;
  tareaId: string | null;
}

export function ArchivosVisita({
  visitaId,
  archivos,
  catalogo,
  onCambio,
}: {
  visitaId: string;
  archivos: VisitaMedia[];
  /** El catálogo entero: cualquier tarea sirve de etiqueta. */
  catalogo: TareaDeCatalogo[];
  onCambio: () => void;
}) {
  const [nuevas, setNuevas] = useState<Nueva[]>([]);
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Qué está eligiendo tarea: una nueva (por índice) o una ya subida. */
  const [eligiendo, setEligiendo] = useState<
    { tipo: "nueva"; indice: number } | { tipo: "subida"; media: VisitaMedia } | null
  >(null);

  const nombreDeTarea = (id: string | null) =>
    id ? (catalogo.find((t) => t.id === id)?.nombre ?? null) : null;

  const sinTarea = nuevas.filter((n) => n.tareaId === null).length;
  const hayCambios = nuevas.length > 0 || quitadas.size > 0;

  function agregar(assets: ImagePicker.ImagePickerAsset[]) {
    setError(null);
    setNuevas((antes) => [
      ...antes,
      ...assets.map((asset) => ({ asset, tareaId: null })),
    ]);
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError("Permite el acceso a la cámara para tomar fotos.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!r.canceled) agregar(r.assets);
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError("Permite el acceso a tus fotos para subirlas.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 20,
    });
    if (!r.canceled) agregar(r.assets);
  }

  function alternarQuitada(id: string) {
    setQuitadas((antes) => {
      const ahora = new Set(antes);
      if (ahora.has(id)) ahora.delete(id);
      else ahora.add(id);
      return ahora;
    });
  }

  function cancelar() {
    setNuevas([]);
    setQuitadas(new Set());
    setError(null);
  }

  /** Lo que entra y lo que sale, en un solo envío. */
  async function guardar() {
    if (!hayCambios || sinTarea > 0) return;
    setGuardando(true);
    setError(null);
    try {
      let subidas: { key: string; tipo: string; tareaId: string }[] = [];

      if (nuevas.length > 0) {
        const aEnviar = nuevas.map(({ asset, tareaId }) => {
          const nombre =
            asset.fileName ?? asset.uri.split("/").pop() ?? `foto-${Date.now()}.jpg`;
          const esVideo = asset.type === "video";
          return {
            uri: asset.uri,
            fileName: nombre,
            contentType: asset.mimeType ?? (esVideo ? "video/mp4" : "image/jpeg"),
            tareaId: tareaId!,
          };
        });

        const presign = await apiRequest<{
          uploads: { key: string; uploadUrl: string; tipo: string; contentType: string }[];
        }>(`/api/mobile/visitas/${visitaId}/media`, {
          method: "POST",
          body: {
            files: aEnviar.map((f) => ({
              fileName: f.fileName,
              contentType: f.contentType,
            })),
          },
        });

        await Promise.all(
          presign.uploads.map(async (u, i) => {
            const blob = await (await fetch(aEnviar[i].uri)).blob();
            const res = await fetch(u.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": u.contentType },
              body: blob,
            });
            if (!res.ok) throw new Error("No pudimos subir uno de los archivos.");
          })
        );

        subidas = presign.uploads.map((u, i) => ({
          key: u.key,
          tipo: u.tipo,
          tareaId: aEnviar[i].tareaId,
        }));
      }

      // Un solo guardado: lo que entra y lo que sale.
      await apiRequest(`/api/mobile/visitas/${visitaId}/media`, {
        method: "PUT",
        body: { files: subidas, eliminar: [...quitadas] },
      });
      // Un arrastre que se confirma: golpe liviano, no notificación. Subir
      // cinco fotos y borrar dos es un compromiso, no un aviso del sistema.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNuevas([]);
      setQuitadas(new Set());
      onCambio();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof ApiError ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function elegirTarea(tareaId: string) {
    const quien = eligiendo;
    setEligiendo(null);
    if (!quien) return;

    if (quien.tipo === "nueva") {
      setNuevas((antes) =>
        antes.map((n, i) => (i === quien.indice ? { ...n, tareaId } : n))
      );
      return;
    }
    // Una ya subida se reetiqueta en el momento: no es un cambio que se pueda
    // "cancelar" junto con los otros, porque la foto ya está.
    try {
      await apiRequest(`/api/mobile/visitas/${visitaId}/media/${quien.media.id}`, {
        method: "PATCH",
        body: { tareaId },
      });
      onCambio();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos etiquetarla");
    }
  }

  const tareaMarcada =
    eligiendo?.tipo === "subida"
      ? eligiendo.media.tareaId
      : eligiendo?.tipo === "nueva"
        ? (nuevas[eligiendo.indice]?.tareaId ?? null)
        : null;

  return (
    <View style={styles.contenedor}>
      <View style={styles.acciones}>
        <PressableScale
          onPress={tomarFoto}
          style={styles.accion}
          estiloPresionado={styles.accionTocada}
        >
          <Ionicons name="camera-outline" size={20} color="#2e7d32" />
          <Text style={styles.accionTexto}>Tomar foto</Text>
        </PressableScale>
        <PressableScale
          onPress={elegirDeGaleria}
          style={styles.accion}
          estiloPresionado={styles.accionTocada}
        >
          <Ionicons name="images-outline" size={20} color="#2e7d32" />
          <Text style={styles.accionTexto}>Galería</Text>
        </PressableScale>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {archivos.length === 0 && nuevas.length === 0 ? (
        <Text style={styles.vacio}>
          Todavía no subiste fotos. Sácalas mientras trabajas.
        </Text>
      ) : (
        <View style={styles.grilla}>
          {/* Las ya subidas. Quitarlas es local hasta que se guarde. */}
          {archivos.map((m) => {
            const fuera = quitadas.has(m.id);
            return (
              <View key={m.id} style={[styles.celda, fuera && styles.celdaFuera]}>
                {m.tipo === "video" ? (
                  <View style={[styles.miniatura, styles.video]}>
                    <Ionicons name="play" size={22} color="#fff" />
                  </View>
                ) : (
                  <Image source={{ uri: m.url }} style={styles.miniatura} />
                )}
                <Pressable
                  onPress={() => alternarQuitada(m.id)}
                  style={[styles.quitar, fuera && styles.quitarDeshacer]}
                  // 24pt de visual + 10 de holgura = 44. El mínimo, y este es
                  // el botón de borrar una foto con las manos embarradas.
                  hitSlop={10}
                >
                  <Ionicons
                    name={fuera ? "arrow-undo" : "close"}
                    size={14}
                    color="#fff"
                  />
                </Pressable>
                {!fuera ? (
                  <Pressable
                    onPress={() => setEligiendo({ tipo: "subida", media: m })}
                    style={styles.etiqueta}
                    hitSlop={4}
                  >
                    <Text style={styles.etiquetaTexto} numberOfLines={1}>
                      {/* "Sin etiqueta" solo lo dicen las viejas: las nuevas no
                          entran sin tarea. */}
                      {nombreDeTarea(m.tareaId) ?? "Sin etiqueta"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {/* Las que están por subir, con su tarea a elegir. */}
          {nuevas.map((n, i) => (
            <View key={`${n.asset.uri}-${i}`} style={[styles.celda, styles.celdaNueva]}>
              {n.asset.type === "video" ? (
                <View style={[styles.miniatura, styles.video]}>
                  <Ionicons name="play" size={22} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: n.asset.uri }} style={styles.miniatura} />
              )}
              <Pressable
                onPress={() => setNuevas((a) => a.filter((_, j) => j !== i))}
                style={styles.quitar}
                hitSlop={10}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setEligiendo({ tipo: "nueva", indice: i })}
                style={[styles.etiqueta, !n.tareaId && styles.etiquetaFalta]}
                hitSlop={{ top: 11, bottom: 11, left: 4, right: 4 }}
              >
                <Text style={styles.etiquetaTexto} numberOfLines={1}>
                  {nombreDeTarea(n.tareaId) ?? "Elegir tarea"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Nada se guarda hasta acá: se puede agregar, quitar y arrepentirse. */}
      {hayCambios ? (
        <View style={styles.barra}>
          <Text style={styles.resumen}>
            {[
              nuevas.length > 0
                ? `${nuevas.length} por subir`
                : null,
              quitadas.size > 0 ? `${quitadas.size} por quitar` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            {sinTarea > 0
              ? sinTarea === 1
                ? " — falta 1 tarea"
                : ` — faltan ${sinTarea} tareas`
              : ""}
          </Text>
          <View style={styles.barraBotones}>
            <PressableScale
              onPress={cancelar}
              disabled={guardando}
              style={styles.cancelar}
              estiloPresionado={styles.cancelarTocado}
            >
              <Text style={styles.cancelarTexto}>Cancelar</Text>
            </PressableScale>
            <PressableScale
              onPress={guardar}
              disabled={guardando || sinTarea > 0}
              style={[
                styles.guardar,
                (guardando || sinTarea > 0) && styles.guardarApagado,
              ]}
            >
              {guardando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.guardarTexto}>Guardar</Text>
              )}
            </PressableScale>
          </View>
        </View>
      ) : null}

      {/* La lista de tareas. Sin opción de dejarla vacía: es obligatoria. */}
      <HojaInferior
        visible={eligiendo !== null}
        onCerrar={() => setEligiendo(null)}
      >
            <Text variant="titleMedium" style={styles.hojaTitulo}>
              ¿De qué es?
            </Text>
            <ScrollView style={styles.hojaLista}>
              {catalogo.map((t) => (
                <PressableScale
                  key={t.id}
                  onPress={() => elegirTarea(t.id)}
                  style={styles.opcion}
                  estiloPresionado={styles.opcionTocada}
                >
                  <Text style={styles.opcionTexto}>{t.nombre}</Text>
                  {tareaMarcada === t.id ? (
                    <Ionicons name="checkmark" size={18} color="#2e7d32" />
                  ) : null}
                </PressableScale>
              ))}
            </ScrollView>
      </HojaInferior>
    </View>
  );
}

const LADO = 104;

const styles = StyleSheet.create({
  contenedor: { gap: 12 },
  acciones: { flexDirection: "row", gap: 10 },
  accion: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c3dfc5",
    backgroundColor: "#f4faf4",
  },
  accionTocada: { backgroundColor: "#e3f1e4" },
  accionTexto: { color: "#2e7d32", fontWeight: "600" },
  error: { color: "#b3261e" },
  vacio: { color: "#888" },

  grilla: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  celda: { width: LADO, height: LADO, borderRadius: 10, overflow: "hidden" },
  /** Marcada para salir: se ve que se va, y se puede deshacer. */
  celdaFuera: { opacity: 0.35 },
  /** Todavía no subida: borde para distinguirla de las que ya están. */
  celdaNueva: { borderWidth: 2, borderColor: "#2e7d32" },
  miniatura: { width: "100%", height: "100%", backgroundColor: "#eee" },
  video: { alignItems: "center", justifyContent: "center", backgroundColor: "#444" },
  quitar: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  quitarDeshacer: { backgroundColor: "rgba(46,125,50,0.85)" },
  etiqueta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  etiquetaFalta: { backgroundColor: "rgba(224,168,0,0.92)" },
  etiquetaTexto: { color: "#fff", fontSize: 10, fontWeight: "600" },

  barra: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f4faf4",
    borderWidth: 1,
    borderColor: "#c3dfc5",
  },
  resumen: { color: "#2e7d32", fontWeight: "600", fontSize: 13 },
  barraBotones: { flexDirection: "row", gap: 10 },
  cancelar: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  cancelarTocado: { backgroundColor: "#f0f0f0" },
  cancelarTexto: { color: "#444", fontWeight: "600" },
  guardar: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#2e7d32",
    alignItems: "center",
    justifyContent: "center",
  },
  guardarApagado: { backgroundColor: "#bdbdbd" },
  guardarTexto: { color: "#fff", fontWeight: "700" },

  hojaTitulo: { color: "#111", fontWeight: "700", paddingHorizontal: 20, paddingBottom: 8 },
  hojaLista: { paddingHorizontal: 12 },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  opcionTocada: { backgroundColor: "#f2f2f2" },
  opcionTexto: { color: "#111", fontSize: 15, flex: 1, paddingRight: 8 },
});
