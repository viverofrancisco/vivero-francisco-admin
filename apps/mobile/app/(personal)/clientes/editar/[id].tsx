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
        empresa: initial.empresa,
        email: initial.email,
        telefono: initial.telefono,
        notas: initial.notas,
        // Editar desde el teléfono toca la primera propiedad, que es la que
        // casi todos tienen. Las demás se manejan desde el portal, con su
        // mapa y sus medidas.
        propiedad: initial.propiedades?.[0]
          ? {
              ciudad: initial.propiedades[0].ciudad,
              sectorId: initial.propiedades[0].sector?.id ?? null,
              direccion: initial.propiedades[0].direccion,
              numeroCasa: initial.propiedades[0].numeroCasa,
              referencia: initial.propiedades[0].referencia,
              m2Total: initial.propiedades[0].m2Total,
            }
          : undefined,
      }}
      onSubmit={submit}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
