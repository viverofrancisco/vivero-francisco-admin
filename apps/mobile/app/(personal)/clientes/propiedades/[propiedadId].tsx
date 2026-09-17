import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { CreatePropiedadBody } from "@vivero/shared";
import { PropiedadForm } from "@/components/PropiedadForm";
import { apiRequest, ApiError } from "@/lib/api";
import type { ClienteStaffDetail, PropiedadResumen } from "@/lib/types";
import { tema } from "@/lib/tema";

export default function PropiedadEditarScreen() {
  const { clienteId, propiedadId } = useLocalSearchParams<{
    clienteId: string;
    propiedadId: string;
  }>();
  const router = useRouter();
  const [propiedad, setPropiedad] = useState<PropiedadResumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * Se pide el cliente entero porque es donde viven sus propiedades: una ruta
   * más para leer una fila que ya viene en la respuesta de al lado sería un
   * endpoint que hay que mantener sincronizado con este mismo dato.
   */
  useEffect(() => {
    if (!clienteId || !propiedadId) return;
    apiRequest<ClienteStaffDetail>(`/api/mobile/clientes/${clienteId}`)
      .then((cliente) => {
        const encontrada = cliente.propiedades.find((p) => p.id === propiedadId);
        if (!encontrada) {
          setError("No encontramos esa propiedad");
          return;
        }
        setPropiedad(encontrada);
      })
      .catch((e) =>
        setError(
          e instanceof ApiError ? e.message : "No pudimos cargar la propiedad"
        )
      );
  }, [clienteId, propiedadId]);

  async function submit(values: CreatePropiedadBody) {
    try {
      await apiRequest(
        `/api/mobile/clientes/${clienteId}/propiedades/${propiedadId}`,
        { method: "PUT", body: values }
      );
      router.back();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new Error("No pudimos guardar los cambios");
    }
  }

  async function eliminar() {
    try {
      await apiRequest(
        `/api/mobile/clientes/${clienteId}/propiedades/${propiedadId}`,
        { method: "DELETE" }
      );
      router.back();
    } catch (e) {
      // El servidor dice cuántas visitas la nombran; ese texto es la respuesta.
      if (e instanceof ApiError) throw e;
      throw new Error("No pudimos eliminar la propiedad");
    }
  }

  if (error) {
    return (
      <View style={styles.centro}>
        <Text style={styles.apagado}>{error}</Text>
      </View>
    );
  }

  if (!propiedad) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <PropiedadForm
      initial={propiedad}
      submitLabel="Guardar cambios"
      onSubmit={submit}
      onEliminar={eliminar}
    />
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  apagado: { color: tema.texto3, textAlign: "center" },
});
