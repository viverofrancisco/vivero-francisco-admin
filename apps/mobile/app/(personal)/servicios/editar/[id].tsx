import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { CreateServicioBody } from "@vivero/shared";
import { ServicioForm } from "@/components/ServicioForm";
import { apiRequest, ApiError } from "@/lib/api";
import type { ServicioDetail } from "@/lib/types";

export default function ServicioEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<ServicioDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    apiRequest<ServicioDetail>(`/api/mobile/servicios/${id}`)
      .then(setInitial)
      .catch(() => {});
  }, [id]);

  async function submit(values: CreateServicioBody) {
    try {
      await apiRequest<ServicioDetail>(`/api/mobile/servicios/${id}`, {
        method: "PUT",
        body: values,
      });
      router.back();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new Error("No pudimos guardar los cambios");
    }
  }

  if (!initial) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ServicioForm
      submitLabel="Guardar cambios"
      initial={{
        nombre: initial.nombre,
        descripcion: initial.descripcion,
        tipo: initial.tipo,
      }}
      onSubmit={submit}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
