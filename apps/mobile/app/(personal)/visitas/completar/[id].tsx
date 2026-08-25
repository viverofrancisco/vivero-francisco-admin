import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiRequest } from "@/lib/api";
import type { VisitaDetail } from "@/lib/types";
import { VisitaResultForm } from "@/components/VisitaResultForm";

export default function CompletarVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  // For first-time completion, leave initialValues undefined so the form
  // starts empty with today's date. For an edit (already COMPLETADA or
  // INCOMPLETA), pre-populate from current values.
  const isEdit = visita?.estado === "COMPLETADA" || visita?.estado === "INCOMPLETA";
  return (
    <VisitaResultForm
      visitaId={id}
      productos={visita?.productos ?? []}
      mode="complete"
      initialValues={
        isEdit && visita
          ? {
              fechaRealizada: visita.fechaRealizada,
              horaEntrada: visita.horaEntrada,
              horaSalida: visita.horaSalida,
              text: visita.notas,
              existingMedia: visita.media,
            }
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
