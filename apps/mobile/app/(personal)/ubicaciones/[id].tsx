import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Ubicacion } from "@vivero/shared";
import { UbicacionForm } from "@/components/UbicacionForm";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

export default function UbicacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Ubicacion>(`/api/mobile/ubicaciones/${id}`)
      .then(setUbicacion)
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar la ubicación")));
  }, [id]);

  function eliminar() {
    Alert.alert(
      `Eliminar ${ubicacion?.nombre ?? "la ubicación"}`,
      "Deja de existir. Si algún pedido la cita, desactívala en vez de eliminarla.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/api/mobile/ubicaciones/${id}`, { method: "DELETE" });
              router.back();
            } catch (e) {
              // Con pedidos el servidor dice que se desactive: eso es lo que hay que leer.
              Alert.alert("No se pudo eliminar", mensajeDeError(e, "Intenta de nuevo en un momento."));
            }
          },
        },
      ]
    );
  }

  // Mientras carga, el encabezado va igual, apagado, para que no salte.
  if (!ubicacion) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFormulario
          titulo="Ubicación"
          accion="Guardar"
          onAccion={() => {}}
          onCancelar={() => router.back()}
          deshabilitado
        />
        <View style={styles.centro}>
          {error ? <Text style={styles.apagado}>{error}</Text> : <ActivityIndicator size="large" />}
        </View>
      </View>
    );
  }

  return (
    <UbicacionForm
      inicial={ubicacion}
      titulo={ubicacion.nombre}
      accion="Guardar"
      onCancelar={() => router.back()}
      onEliminar={eliminar}
      onSubmit={async (valores) => {
        await apiRequest(`/api/mobile/ubicaciones/${id}`, { method: "PUT", body: valores });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  apagado: { color: tema.texto3, textAlign: "center" },
});
