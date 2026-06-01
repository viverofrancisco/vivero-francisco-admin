import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiRequest } from "@/lib/api";
import type { VisitaDetail } from "@/lib/types";
import { VisitaChat } from "@/components/VisitaChat";

export default function ClienteVisitaChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [visita, setVisita] = useState<VisitaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiRequest<VisitaDetail>(`/api/mobile/visitas/${id}`)
      .then(setVisita)
      .catch(() => setVisita(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) return null;
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Entry from visita detail: banner is read-only context. Tapping it would
  // re-open the same visita the user just came from (recursive stack).
  return (
    <VisitaChat
      visitaId={id}
      title="Mensajes"
      subtitle={visita?.clienteServicio.servicio.nombre}
      banner={
        visita
          ? {
              fechaProgramada: visita.fechaProgramada,
              estado: visita.estado,
              servicioNombre: visita.clienteServicio.servicio.nombre,
            }
          : undefined
      }
      onBack={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
