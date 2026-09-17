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
      // La dirección y las medidas viven en cada propiedad, que se abre desde
      // la ficha del cliente. Acá estaban y no se guardaban.
      pidePropiedad={false}
      initial={{
        nombre: initial.nombre,
        apellido: initial.apellido,
        empresa: initial.empresa,
        email: initial.email,
        telefono: initial.telefono,
        notas: initial.notas,
      }}
      onSubmit={submit}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
