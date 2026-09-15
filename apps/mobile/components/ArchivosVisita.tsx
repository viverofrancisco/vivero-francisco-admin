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
 * Se sube apenas se elige, sin botón de guardar: el archivo es de la visita, no
 * de un formulario, y en cualquier estado.
 *
 * **La etiqueta puede ser cualquier tarea viva**, no solo las que uno marcó. En
 * el campo se fotografía lo que aparece, y limitar la etiqueta a lo que uno
 * hizo deja esas fotos sin clasificar — que es justo lo que le impide al
 * informe ponerlas en su sección.
 */
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
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Qué foto está eligiendo etiqueta. */
  const [etiquetando, setEtiquetando] = useState<VisitaMedia | null>(null);

  const nombreDeTarea = (id: string | null) =>
    id ? (catalogo.find((t) => t.id === id)?.nombre ?? null) : null;

  async function subir(assets: ImagePicker.ImagePickerAsset[]) {
    if (assets.length === 0) return;
    setSubiendo(true);
    setError(null);
    try {
      const archivosAEnviar = assets.map((a) => {
        const nombre =
          a.fileName ?? a.uri.split("/").pop() ?? `foto-${Date.now()}.jpg`;
        const esVideo = a.type === "video";
        return {
          uri: a.uri,
          fileName: nombre,
          contentType: a.mimeType ?? (esVideo ? "video/mp4" : "image/jpeg"),
        };
      });

      const presign = await apiRequest<{
        uploads: { key: string; uploadUrl: string; tipo: string; contentType: string }[];
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

      // Se confirman sin etiqueta y se etiqueta después tocando la foto:
      // preguntar por cada una antes de subirlas es una pregunta entre el
      // momento de sacar la foto y el de tenerla guardada.
      await apiRequest(`/api/mobile/visitas/${visitaId}/media`, {
        method: "PUT",
        body: {
          files: presign.uploads.map((u) => ({ key: u.key, tipo: u.tipo })),
        },
      });
      onCambio();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos subir");
    } finally {
      setSubiendo(false);
    }
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError("Permite el acceso a la cámara para tomar fotos.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!r.canceled) await subir(r.assets);
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
    if (!r.canceled) await subir(r.assets);
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

  async function etiquetar(m: VisitaMedia, tareaId: string | null) {
    setEtiquetando(null);
    try {
      await apiRequest(`/api/mobile/visitas/${visitaId}/media/${m.id}`, {
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
          disabled={subiendo}
          style={({ pressed }) => [styles.accion, pressed && styles.accionTocada]}
        >
          <Ionicons name="camera-outline" size={20} color="#2e7d32" />
          <Text style={styles.accionTexto}>Tomar foto</Text>
        </Pressable>
        <Pressable
          onPress={elegirDeGaleria}
          disabled={subiendo}
          style={({ pressed }) => [styles.accion, pressed && styles.accionTocada]}
        >
          <Ionicons name="images-outline" size={20} color="#2e7d32" />
          <Text style={styles.accionTexto}>Galería</Text>
        </Pressable>
      </View>

      {subiendo ? (
        <View style={styles.subiendo}>
          <ActivityIndicator size="small" color="#2e7d32" />
          <Text style={styles.subiendoTexto}>Subiendo…</Text>
        </View>
      ) : null}

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
              <Pressable
                onPress={() => borrar(m)}
                style={styles.quitar}
                hitSlop={8}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setEtiquetando(m)}
                style={styles.etiqueta}
                hitSlop={4}
              >
                <Text style={styles.etiquetaTexto} numberOfLines={1}>
                  {nombreDeTarea(m.tareaId) ?? "Sin etiqueta"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Cualquier tarea del catálogo, no solo las que marcó. */}
      <Modal
        visible={etiquetando !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEtiquetando(null)}
      >
        <Pressable style={styles.fondo} onPress={() => setEtiquetando(null)}>
          <Pressable style={styles.hoja} onPress={(e) => e.stopPropagation()}>
            <Text variant="titleMedium" style={styles.hojaTitulo}>
              ¿De qué es esta foto?
            </Text>
            <ScrollView style={styles.hojaLista}>
              <Pressable
                onPress={() => etiquetando && etiquetar(etiquetando, null)}
                style={({ pressed }) => [styles.opcion, pressed && styles.opcionTocada]}
              >
                <Text style={styles.opcionTexto}>Sin etiqueta</Text>
              </Pressable>
              {catalogo.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => etiquetando && etiquetar(etiquetando, t.id)}
                  style={({ pressed }) => [styles.opcion, pressed && styles.opcionTocada]}
                >
                  <Text style={styles.opcionTexto}>{t.nombre}</Text>
                  {etiquetando?.tareaId === t.id ? (
                    <Ionicons name="checkmark" size={18} color="#2e7d32" />
                  ) : null}
                </Pressable>
              ))}
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
  subiendo: { flexDirection: "row", alignItems: "center", gap: 8 },
  subiendoTexto: { color: "#666" },
  error: { color: "#b3261e" },
  vacio: { color: "#888" },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  celda: { width: LADO, height: LADO, borderRadius: 10, overflow: "hidden" },
  miniatura: { width: "100%", height: "100%", backgroundColor: "#eee" },
  video: { alignItems: "center", justifyContent: "center", backgroundColor: "#444" },
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

  fondo: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
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
