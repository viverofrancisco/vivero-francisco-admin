import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TareaForm } from "@/components/TareaForm";
import { apiRequest, mensajeDeError } from "@/lib/api";
import { tema } from "@/lib/tema";

interface Tarea {
  id: string;
  nombre: string;
  descripcion: string | null;
}

export default function TareaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * La ficha sale de la lista: el catálogo entero son diecisiete filas, así que
   * pedir la tarea sola sería una ruta más para traer lo que ya vino.
   */
  useEffect(() => {
    apiRequest<{ items: Tarea[] }>("/api/mobile/tareas")
      .then((res) => {
        const encontrada = res.items.find((t) => t.id === id);
        if (!encontrada) setError("No encontramos esa tarea");
        else setTarea(encontrada);
      })
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar la tarea")));
  }, [id]);

  function eliminar() {
    Alert.alert(
      `Eliminar ${tarea?.nombre ?? "la tarea"}`,
      "Deja de aparecer al elegir tareas. Las visitas donde se hizo la siguen nombrando.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/api/mobile/tareas/${id}`, { method: "DELETE" });
              router.back();
            } catch (e) {
              setError(mensajeDeError(e, "No pudimos eliminarla"));
            }
          },
        },
      ]
    );
  }

  if (error && !tarea) {
    return (
      <View style={styles.centro}>
        <Text style={styles.apagado}>{error}</Text>
      </View>
    );
  }
  if (!tarea) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <TareaForm
      inicial={tarea}
      etiqueta="Guardar cambios"
      onEliminar={eliminar}
      onSubmit={async (valores) => {
        await apiRequest(`/api/mobile/tareas/${id}`, {
          method: "PUT",
          body: valores,
        });
        router.back();
      }}
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
