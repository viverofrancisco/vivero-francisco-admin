import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Portal,
  Text,
} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { nombreCliente, resumenDePropiedades } from "@vivero/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { PressableScale } from "@/components/ui/PressableScale";
import { tema } from "@/lib/tema";

interface InformeDetail {
  id: string;
  titulo: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  pdfUrl: string;
  generatedAt: string;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa: string | null;
  };
  visitasCount: number;
  /** En qué propiedades pasó. Sale de las visitas; vacío si no cubre ninguna. */
  propiedades: string[];
}

export default function InformeDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<InformeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<InformeDetail>(
        `/api/mobile/informes/${id}`
      );
      setData(res);
    } catch (e) {
      setError(
        mensajeDeError(e, "No pudimos cargar el informe")
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  async function openPdf() {
    if (!data?.pdfUrl) return;
    try {
      await WebBrowser.openBrowserAsync(data.pdfUrl);
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiRequest(`/api/mobile/informes/${id}`, { method: "DELETE" });
      router.back();
    } catch (e) {
      setError(
        mensajeDeError(e, "No pudimos eliminar el informe")
      );
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "No encontrado"}</Text>
        <Button onPress={() => router.back()}>Volver</Button>
      </View>
    );
  }

  return (
    <View style={styles.pantalla}>
      {/* El mismo encabezado que la ficha de la visita: la flecha y el nombre
          del cliente en grande. La barra nativa gastaba un renglón en decir
          "Informe" al lado de un botón que ya decía "Informes", y el título
          del informe —que es derivado y casi siempre el mismo— se llevaba la
          línea que ahora usa el cliente. */}
      <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
        <PressableScale
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.volver}
        >
          <Ionicons name="chevron-back" size={24} color={tema.texto} />
        </PressableScale>
        <View style={styles.encabezadoTexto}>
          <Text style={styles.heroTitulo} numberOfLines={2}>
            {nombreCliente(data.cliente)}
          </Text>
          <Text style={styles.heroSubtitulo} numberOfLines={1}>
            {data.titulo}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Card style={styles.card}>
        <Card.Content>
          <Row label="Generado" value={formatGeneratedAt(data.generatedAt)} />
          {data.fechaDesde && data.fechaHasta ? (
            <Row
              label="Período"
              value={formatRange(data.fechaDesde, data.fechaHasta)}
            />
          ) : null}
          <Row
            label="Visitas incluidas"
            value={`${data.visitasCount}`}
          />
          {/* Sin visitas no hay propiedad que mostrar, y eso es distinto de
              un guión: el informe simplemente no cuenta trabajo de ninguna. */}
          {data.propiedades.length > 0 ? (
            <Row
              label={
                data.propiedades.length === 1 ? "Propiedad" : "Propiedades"
              }
              value={resumenDePropiedades(data.propiedades) ?? ""}
            />
          ) : null}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={openPdf}
        icon={({ size, color }) => (
          <Ionicons name="document-text" size={size} color={color} />
        )}
        style={styles.action}
        contentStyle={styles.actionContent}
      >
        Ver PDF
      </Button>

      <Button
        mode="outlined"
        onPress={() => setConfirmOpen(true)}
        icon={({ size, color }) => (
          <Ionicons name="trash-outline" size={size} color={color} />
        )}
        style={[styles.action, styles.deleteAction]}
        textColor="#c62828"
      >
        Eliminar informe
      </Button>

      <Text style={styles.hint}>
        Para editar o regenerar este informe usa el panel web.
      </Text>

      <Portal>
        <Dialog
          visible={confirmOpen}
          onDismiss={() => !deleting && setConfirmOpen(false)}
        >
          <Dialog.Title>Eliminar informe</Dialog.Title>
          <Dialog.Content>
            <Text>
              ¿Seguro que quieres eliminar este informe? El PDF también será
              eliminado.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              onPress={handleDelete}
              loading={deleting}
              textColor="#c62828"
            >
              Eliminar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRange(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-EC", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(from)} → ${fmt(to)}`;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  encabezado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
  },
  volver: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  encabezadoTexto: { flex: 1, gap: 1 },
  heroTitulo: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: tema.texto,
  },
  heroSubtitulo: { fontSize: 13, color: tema.texto3 },

  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 16, gap: 12 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  errorText: { color: "#c62828" },
  card: { backgroundColor: "#fff" },
  title: { fontWeight: "600" },
  subtitle: { color: "#555", marginTop: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowLabel: { color: "#666" },
  rowValue: { color: "#222", fontWeight: "500" },
  action: { marginTop: 4 },
  actionContent: { paddingVertical: 4 },
  deleteAction: { borderColor: "#c62828" },
  hint: {
    textAlign: "center",
    color: "#888",
    fontSize: 12,
    marginTop: 8,
  },
});
