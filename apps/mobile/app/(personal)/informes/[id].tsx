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
import { apiRequest, ApiError } from "@/lib/api";

interface InformeDetail {
  id: string;
  titulo: string;
  fechaDesde: string | null;
  fechaHasta: string | null;
  pdfUrl: string;
  generatedAt: string;
  cliente: { id: string; nombre: string };
  visitasCount: number;
}

export default function InformeDetailScreen() {
  const router = useRouter();
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
        e instanceof ApiError ? e.message : "No pudimos cargar el informe"
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
        e instanceof ApiError ? e.message : "No pudimos eliminar el informe"
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            {data.titulo}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {data.cliente.nombre}
          </Text>
        </Card.Content>
      </Card>

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
