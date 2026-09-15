import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { apiRequest, ApiError } from "@/lib/api";

/** Lo que ya dejó, si dejó algo. */
export interface Calificacion {
  estrellas: number;
  comentario: string | null;
  fotos: { id: string; url: string }[];
}

interface FotoLocal {
  uri: string;
  fileName: string;
  contentType: string;
}

/**
 * Cómo le fue al cliente con la visita.
 *
 * Aparece cuando la visita se cierra, que es el único momento en que tiene algo
 * que decir. Las estrellas son lo único obligatorio: la mayoría no escribe
 * nada, y pedir un texto para aceptar la calificación es quedarse sin las
 * estrellas también.
 *
 * Se puede volver a entrar y cambiarla: es su opinión, y cambiar de opinión
 * sobre un jardín pasa —vuelve al día siguiente y ve algo que no había visto—.
 */
export function CalificarVisita({
  visitaId,
  inicial,
  onListo,
}: {
  visitaId: string;
  inicial: Calificacion | null;
  onListo: () => void;
}) {
  const [estrellas, setEstrellas] = useState(inicial?.estrellas ?? 0);
  const [comentario, setComentario] = useState(inicial?.comentario ?? "");
  /** Las que ya estaban, más las nuevas. Lo que quede acá es lo que se guarda. */
  const [existentes, setExistentes] = useState(inicial?.fotos ?? []);
  const [nuevas, setNuevas] = useState<FotoLocal[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function agregar(assets: ImagePicker.ImagePickerAsset[]) {
    setNuevas((antes) => [
      ...antes,
      ...assets.map((a) => ({
        uri: a.uri,
        fileName: a.fileName ?? `foto-${Date.now()}.jpg`,
        contentType: a.mimeType ?? "image/jpeg",
      })),
    ]);
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!r.canceled) agregar(r.assets);
  }

  async function elegirDeGaleria() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!r.canceled) agregar(r.assets);
  }

  /** Sube las nuevas a R2 y devuelve sus claves, en el orden en que se ven. */
  async function subirNuevas(): Promise<{ key: string }[]> {
    if (nuevas.length === 0) return [];
    const presign = await apiRequest<{
      uploads: { key: string; uploadUrl: string; contentType: string }[];
    }>(`/api/mobile/visitas/${visitaId}/calificacion/upload-urls`, {
      method: "POST",
      body: {
        files: nuevas.map((f) => ({
          fileName: f.fileName,
          contentType: f.contentType,
        })),
      },
    });

    await Promise.all(
      presign.uploads.map(async (u, i) => {
        const blob = await (await fetch(nuevas[i].uri)).blob();
        const res = await fetch(u.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": u.contentType },
          body: blob,
        });
        if (!res.ok) throw new Error("No pudimos subir una de las fotos.");
      })
    );
    return presign.uploads.map((u) => ({ key: u.key }));
  }

  async function guardar() {
    if (estrellas < 1) return;
    setGuardando(true);
    setError(null);
    try {
      const subidas = await subirNuevas();
      await apiRequest(`/api/mobile/visitas/${visitaId}/calificacion`, {
        method: "POST",
        body: {
          estrellas,
          comentario: comentario.trim() || null,
          // Las que quedaron más las nuevas: lo que se manda es el estado
          // final, así que sacar una de la lista la saca de verdad.
          fotos: [
            ...existentes.map((f) => ({ key: claveDeUrl(f.url) })),
            ...subidas,
          ].filter((f) => f.key),
        },
      });
      onListo();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <Text variant="titleMedium" style={styles.titulo}>
        ¿Cómo quedó tu jardín?
      </Text>

      <View style={styles.estrellas}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setEstrellas(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${n} de 5`}
          >
            <Ionicons
              name={n <= estrellas ? "star" : "star-outline"}
              size={40}
              color={n <= estrellas ? "#f5a623" : "#c7c7c7"}
            />
          </Pressable>
        ))}
      </View>

      <TextInput
        mode="outlined"
        label="¿Querés contarnos algo? (opcional)"
        value={comentario}
        onChangeText={setComentario}
        multiline
        numberOfLines={4}
        style={styles.texto}
      />

      {(existentes.length > 0 || nuevas.length > 0) && (
        <View style={styles.fotos}>
          {existentes.map((f) => (
            <Miniatura
              key={f.id}
              uri={f.url}
              onQuitar={() =>
                setExistentes((a) => a.filter((x) => x.id !== f.id))
              }
            />
          ))}
          {nuevas.map((f, i) => (
            <Miniatura
              key={`${f.uri}-${i}`}
              uri={f.uri}
              onQuitar={() => setNuevas((a) => a.filter((_, j) => j !== i))}
            />
          ))}
        </View>
      )}

      <View style={styles.botonesFoto}>
        <Button mode="outlined" icon="camera" onPress={tomarFoto} textColor="#2e7d32">
          Tomar foto
        </Button>
        <Button mode="outlined" icon="image" onPress={elegirDeGaleria} textColor="#2e7d32">
          Galería
        </Button>
      </View>

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      <Button
        mode="contained"
        onPress={guardar}
        loading={guardando}
        disabled={guardando || estrellas < 1}
        buttonColor="#2e7d32"
        textColor="#fff"
        style={styles.enviar}
        contentStyle={styles.enviarContenido}
      >
        {inicial ? "Guardar cambios" : "Enviar"}
      </Button>
    </ScrollView>
  );
}

function Miniatura({ uri, onQuitar }: { uri: string; onQuitar: () => void }) {
  return (
    <View style={styles.miniatura}>
      <Image source={{ uri }} style={styles.miniaturaImg} />
      <Pressable style={styles.quitar} onPress={onQuitar} hitSlop={8}>
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>
    </View>
  );
}

/**
 * La clave de R2 que hay dentro de una URL pública.
 *
 * Las fotos que ya estaban vuelven como URL, y el servidor las quiere por
 * clave. Se saca del path en vez de guardarla aparte: es la misma cadena y
 * tenerla dos veces es tenerla desincronizada.
 */
function claveDeUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  contenido: { padding: 20, gap: 16 },
  titulo: { color: "#111", fontWeight: "700", textAlign: "center" },
  estrellas: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 4,
  },
  texto: { backgroundColor: "#fff" },
  fotos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  miniatura: { width: 76, height: 76, borderRadius: 10, overflow: "hidden" },
  miniaturaImg: { width: "100%", height: "100%" },
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
  botonesFoto: { flexDirection: "row", gap: 10 },
  enviar: { borderRadius: 12, marginTop: 4 },
  enviarContenido: { height: 52 },
});
