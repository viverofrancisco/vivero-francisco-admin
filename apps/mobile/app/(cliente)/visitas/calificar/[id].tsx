import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { apiRequest } from "@/lib/api";
import {
  CalificarVisita,
  type Calificacion,
} from "@/components/CalificarVisita";

/** La pantalla de calificar. Se llega desde la visita o desde el aviso. */
export default function CalificarVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [inicial, setInicial] = useState<Calificacion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: "Calificar" });
  }, [navigation]);

  useEffect(() => {
    if (!id) return;
    apiRequest<{ calificacion: Calificacion | null }>(
      `/api/mobile/visitas/${id}/calificacion`
    )
      .then((r) => setInicial(r.calificacion))
      .catch(() => setInicial(null))
      .finally(() => setCargando(false));
  }, [id]);

  if (!id) return null;
  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <CalificarVisita
      visitaId={id}
      inicial={inicial}
      onListo={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
});
