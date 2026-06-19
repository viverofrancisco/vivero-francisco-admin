import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { nombreCliente } from "@vivero/shared";
import { apiRequest } from "@/lib/api";
import type { VisitaDetail } from "@/lib/types";
import { VisitaChat } from "@/components/VisitaChat";

export default function PersonalVisitaChatScreen() {
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

  const cliente = visita?.clienteServicio.cliente;
  const clienteFullName = cliente ? nombreCliente(cliente) : undefined;

  // Entry from visita detail: banner is read-only context.
  return (
    <VisitaChat
      visitaId={id}
      title={clienteFullName ?? "Mensajes"}
      subtitle={visita?.clienteServicio.servicio.nombre}
      banner={
        visita
          ? {
              fechaProgramada: visita.fechaProgramada,
              estado: visita.estado,
              servicioNombre: visita.clienteServicio.servicio.nombre,
              clienteNombre: clienteFullName,
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
