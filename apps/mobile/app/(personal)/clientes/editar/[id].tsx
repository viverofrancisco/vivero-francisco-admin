import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { CreateClienteBody } from "@vivero/shared";
import { ClienteForm } from "@/components/ClienteForm";
import { apiRequest, ApiError } from "@/lib/api";
import type { ClienteStaffDetail } from "@/lib/types";

export default function ClienteEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<ClienteStaffDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    apiRequest<ClienteStaffDetail>(`/api/mobile/clientes/${id}`)
      .then(setInitial)
      .catch(() => {});
  }, [id]);

  async function submit(values: CreateClienteBody) {
    try {
      await apiRequest(`/api/mobile/clientes/${id}`, {
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
    <ClienteForm
      submitLabel="Guardar cambios"
      initial={{
        nombre: initial.nombre,
        apellido: initial.apellido,
        email: initial.email,
        telefono: initial.telefono,
        ciudad: initial.ciudad,
        sectorId: initial.sector?.id ?? null,
        direccion: initial.direccion,
        numeroCasa: initial.numeroCasa,
        referencia: initial.referencia,
        notas: initial.notas,
        metrosCuadrados: initial.metrosCuadrados,
      }}
      onSubmit={submit}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
