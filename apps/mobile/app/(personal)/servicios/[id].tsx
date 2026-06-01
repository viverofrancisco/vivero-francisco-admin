import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Text,
} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiRequest, ApiError } from "@/lib/api";
import type { ServicioDetail } from "@/lib/types";

export default function ServicioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ServicioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiRequest<ServicioDetail>(
        `/api/mobile/servicios/${id}`
      );
      setData(res);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No pudimos cargar el servicio"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
        <Text variant="bodyMedium" style={styles.muted}>
          {error ?? "Servicio no encontrado"}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card mode="outlined">
        <Card.Title
          title={data.nombre}
          subtitle={`${data._count.clientes} cliente${data._count.clientes === 1 ? "" : "s"} activo${data._count.clientes === 1 ? "" : "s"}`}
          right={() => (
            <Chip compact mode="flat" style={styles.chip}>
              {data.tipo === "RECURRENTE" ? "Recurrente" : "Único"}
            </Chip>
          )}
        />
        <Card.Content>
          {data.descripcion ? (
            <Text variant="bodyMedium" style={styles.descripcion}>
              {data.descripcion}
            </Text>
          ) : (
            <Text variant="bodyMedium" style={styles.muted}>
              Sin descripción.
            </Text>
          )}
        </Card.Content>
      </Card>

      <Button
        mode="outlined"
        icon="pencil"
        onPress={() => router.push(`/(personal)/servicios/editar/${id}`)}
      >
        Editar servicio
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 16 },
  chip: { marginRight: 12, alignSelf: "center" },
  descripcion: { lineHeight: 22 },
  muted: { color: "#666" },
});
