import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { apiRequest, ApiError } from "@/lib/api";
import type { VisitaMedia } from "@/lib/types";
import type { TareaDeCatalogo } from "@/components/VisitaResultForm";

/**
 * Las fotos de la visita, en la ficha y en cualquier momento.
 *
 * Estaban dentro del formulario de salida, y ahí llegaban tarde: la foto se
 * saca **mientras** se trabaja —antes y después de podar, el riego roto que
 * apareció— y guardarla para el final es pedirle a alguien que se acuerde. Ese
 * formulario ahora pregunta una sola cosa, qué tareas hizo.
 *
 * **La tarea es obligatoria**, y se elige foto por foto antes de subir: una
 * sesión de la galería trae la poda y el riego mezclados, así que una etiqueta
 * para todo el lote sería mentira la mitad de las veces. Una foto sin tarea es
 * exactamente la que el informe no puede ubicar — queda en el montón suelto y
 * alguien la clasifica después, mirándola y tratando de acordarse.
 *
 * Puede ser **cualquier tarea viva**, no solo las que uno marcó: en el campo se
 * fotografía lo que aparece, y limitar la etiqueta a lo que uno hizo deja justo
 * esas fotos sin clasificar.
 */

/** Una foto elegida que todavía no se subió, con la tarea que le tocó. */
interface Pendiente {
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
  const insets = useSafeAreaInsets();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Lo elegido, esperando que cada una tenga tarea. */
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  /** Índice del pendiente cuya tarea se está eligiendo, o la ya subida. */
  const [eligiendo, setEligiendo] = useState<number | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<VisitaMedia | null>(null);

  const nombreDeTarea = (id: string | null) =>
    id ? (catalogo.find((t) => t.id === id)?.nombre ?? null) : null;

  const sinTarea = pendientes.filter((p) => p.tareaId === null).length;

  function agregar(assets: ImagePicker.ImagePickerAsset[]) {
    setError(null);
    setPendientes((antes) => [
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

  /** Todo junto, una vez que cada foto sabe de qué es. */
  async function subirTodo() {
    if (pendientes.length === 0 || sinTarea > 0) return;
    setSubiendo(true);
    setError(null);
    try {
      const archivosAEnviar = pendientes.map(({ asset, tareaId }) => {
        const nombre =
          asset.fileName ??
          asset.uri.split("/").pop() ??
          `foto-${Date.now()}.jpg`;
        const esVideo = asset.type === "video";
        return {
          uri: asset.uri,
          fileName: nombre,
          contentType: asset.mimeType ?? (esVideo ? "video/mp4" : "image/jpeg"),
          tareaId: tareaId!,
        };
      });

      const presign = await apiRequest<{
        uploads: {
          key: string;
          uploadUrl: string;
          tipo: string;
          contentType: string;
        }[];
      }>(`/api/mobile/visitas/${visitaId}/media`, {
        method: "POST",
        body: {
          files: archivosAEnviar.map((f) => ({
            fileName: f.fileName,
            contentType: f.contentType,
          })),
        },
      });

      await Promise.all(
        presign.uploads.map(async (u, i) => {
          const blob = await (await fetch(archivosAEnviar[i].uri)).blob();
          const res = await fetch(u.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": u.contentType },
            body: blob,
          });
          if (!res.ok) throw new Error("No pudimos subir uno de los archivos.");
        })
      );

      // Con su tarea desde el primer momento: el servidor la exige, así que una
      // foto sin clasificar no entra ni por error.
      await apiRequest(`/api/mobile/visitas/${visitaId}/media`, {
        method: "PUT",
        body: {
          files: presign.uploads.map((u, i) => ({
            key: u.key,
            tipo: u.tipo,
            tareaId: archivosAEnviar[i].tareaId,
          })),
        },
      });
      setPendientes([]);
      onCambio();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos subir");
    } finally {
      setSubiendo(false);
    }
  }

  async function borrar(m: VisitaMedia) {
    try {
      await apiRequest(`/api/mobile/visitas/${visitaId}/media/${m.id}`, {
        method: "DELETE",
      });
      onCambio();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos borrarla");
    }
  }

  /** La hoja de tareas sirve para las dos cosas: elegir y corregir. */
  async function elegirTarea(tareaId: string) {
    const indice = eligiendo;
    const aCorregir = corrigiendo;
    setEligiendo(null);
    setCorrigiendo(null);

    if (indice !== null) {
      setPendientes((antes) =>
        antes.map((p, i) => (i === indice ? { ...p, tareaId } : p))
      );
      return;
    }
    if (!aCorregir) return;
    try {
      await apiRequest(`/api/mobile/visitas/${visitaId}/media/${aCorregir.id}`, {
        method: "PATCH",
        body: { tareaId },
      });
      onCambio();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos etiquetarla");
    }
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.acciones}>
        <Pressable
          onPress={tomarFoto}
          style={({ pressed }) => [styles.accion, pressed && styles.accionTocada]}
        >
          <Ionicons name="camera-outline" size={20} color="#2e7d32" />
          <Text style={styles.accionTexto}>Tomar foto</Text>
        </Pressable>
        <Pressable
          onPress={elegirDeGaleria}
          style={({ pressed }) => [styles.accion, pressed && styles.accionTocada]}
        >
          <Ionicons name="images-outline" size={20} color="#2e7d32" />
          <Text style={styles.accionTexto}>Galería</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {archivos.length === 0 ? (
        <Text style={styles.vacio}>
          Todavía no hay fotos. Sácalas mientras trabajas.
        </Text>
      ) : (
        <View style={styles.grilla}>
          {archivos.map((m) => (
            <View key={m.id} style={styles.celda}>
              {m.tipo === "video" ? (
                <View style={[styles.miniatura, styles.video]}>
                  <Ionicons name="play" size={22} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: m.url }} style={styles.miniatura} />
              )}
              <Pressable onPress={() => borrar(m)} style={styles.quitar} hitSlop={8}>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setCorrigiendo(m)}
                style={styles.etiqueta}
                hitSlop={4}
              >
                <Text style={styles.etiquetaTexto} numberOfLines={1}>
                  {/* "Sin etiqueta" solo lo pueden decir las viejas: las
                      nuevas no entran sin tarea. */}
                  {nombreDeTarea(m.tareaId) ?? "Sin etiqueta"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* La pantalla de subida: cada foto elige su tarea, y después van todas
          juntas. Una sesión de la galería trae la poda y el riego mezclados,
          así que una etiqueta para todo el lote sería mentira la mitad de las
          veces. */}
      <Modal
        visible={pendientes.length > 0}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !subiendo && setPendientes([])}
      >
        <View style={styles.pantalla}>
          <View style={styles.barra}>
            <Pressable onPress={() => !subiendo && setPendientes([])} hitSlop={10}>
              <Text style={styles.cancelar}>Cancelar</Text>
            </Pressable>
            <Text variant="titleMedium" style={styles.barraTitulo}>
              {pendientes.length === 1
                ? "1 archivo"
                : `${pendientes.length} archivos`}
            </Text>
            <View style={styles.barraHueco} />
          </View>

          <ScrollView contentContainerStyle={styles.lista}>
            <Text style={styles.ayuda}>
              Elige de qué tarea es cada una. Sin eso no se pueden subir: es lo
              que las ubica en el informe.
            </Text>
            {pendientes.map((p, i) => (
              <View key={`${p.asset.uri}-${i}`} style={styles.fila}>
                {p.asset.type === "video" ? (
                  <View style={[styles.filaMiniatura, styles.video]}>
                    <Ionicons name="play" size={20} color="#fff" />
                  </View>
                ) : (
                  <Image
                    source={{ uri: p.asset.uri }}
                    style={styles.filaMiniatura}
                  />
                )}
                <Pressable
                  onPress={() => setEligiendo(i)}
                  style={({ pressed }) => [
                    styles.selector,
                    !p.tareaId && styles.selectorVacio,
                    pressed && styles.selectorTocado,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorTexto,
                      !p.tareaId && styles.selectorTextoVacio,
                    ]}
                    numberOfLines={2}
                  >
                    {nombreDeTarea(p.tareaId) ?? "Elegir tarea"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </Pressable>
                <Pressable
                  onPress={() =>
                    setPendientes((a) => a.filter((_, j) => j !== i))
                  }
                  hitSlop={10}
                  style={styles.filaQuitar}
                >
                  <Ionicons name="close" size={18} color="#888" />
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.pie, { paddingBottom: insets.bottom + 16 }]}>
            {sinTarea > 0 ? (
              <Text style={styles.falta}>
                {sinTarea === 1
                  ? "Falta la tarea de 1 archivo"
                  : `Faltan las tareas de ${sinTarea} archivos`}
              </Text>
            ) : null}
            <Pressable
              onPress={subirTodo}
              disabled={subiendo || sinTarea > 0}
              style={[
                styles.subir,
                (subiendo || sinTarea > 0) && styles.subirApagado,
              ]}
            >
              {subiendo ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.subirTexto}>
                  {pendientes.length === 1
                    ? "Subir"
                    : `Subir ${pendientes.length}`}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* La lista de tareas. Sin opción de dejarla vacía: es obligatoria. */}
      <Modal
        visible={eligiendo !== null || corrigiendo !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setEligiendo(null);
          setCorrigiendo(null);
        }}
      >
        <Pressable
          style={styles.fondo}
          onPress={() => {
            setEligiendo(null);
            setCorrigiendo(null);
          }}
        >
          <Pressable style={styles.hoja} onPress={(e) => e.stopPropagation()}>
            <Text variant="titleMedium" style={styles.hojaTitulo}>
              ¿De qué es?
            </Text>
            <ScrollView style={styles.hojaLista}>
              {catalogo.map((t) => {
                const marcada =
                  corrigiendo?.tareaId === t.id ||
                  (eligiendo !== null && pendientes[eligiendo]?.tareaId === t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => elegirTarea(t.id)}
                    style={({ pressed }) => [
                      styles.opcion,
                      pressed && styles.opcionTocada,
                    ]}
                  >
                    <Text style={styles.opcionTexto}>{t.nombre}</Text>
                    {marcada ? (
                      <Ionicons name="checkmark" size={18} color="#2e7d32" />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const LADO = 96;

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
  miniatura: { width: "100%", height: "100%", backgroundColor: "#eee" },
  video: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#444",
  },
  quitar: {
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
  etiqueta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  etiquetaTexto: { color: "#fff", fontSize: 10, fontWeight: "600" },

  pantalla: { flex: 1, backgroundColor: "#fff" },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  barraTitulo: { color: "#111", fontWeight: "700" },
  barraHueco: { width: 64 },
  cancelar: { color: "#2e7d32", fontSize: 16, width: 64 },
  lista: { padding: 16, gap: 12 },
  ayuda: { color: "#888", fontSize: 13, marginBottom: 4 },
  fila: { flexDirection: "row", alignItems: "center", gap: 12 },
  filaMiniatura: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  selector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selectorVacio: { borderColor: "#e0a800", backgroundColor: "#fffaf0" },
  selectorTocado: { backgroundColor: "#f2f2f2" },
  selectorTexto: { color: "#111", flex: 1, fontSize: 14 },
  selectorTextoVacio: { color: "#8a6d00", fontWeight: "600" },
  filaQuitar: { padding: 4 },
  pie: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  falta: { color: "#8a6d00", fontSize: 13, textAlign: "center" },
  subir: {
    backgroundColor: "#2e7d32",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  subirApagado: { backgroundColor: "#bdbdbd" },
  subirTexto: { color: "#fff", fontWeight: "700", fontSize: 16 },

  fondo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  hoja: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: "70%",
  },
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
