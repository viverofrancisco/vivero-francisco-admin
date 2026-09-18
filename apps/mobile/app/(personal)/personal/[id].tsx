import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PersonalForm } from "@/components/PersonalForm";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { PersonalFicha } from "@/lib/types";
import { tema } from "@/lib/tema";

export default function PersonalFichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ficha, setFicha] = useState<PersonalFicha | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<PersonalFicha>(`/api/mobile/personal/${id}`)
      .then(setFicha)
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar la ficha")));
  }, [id]);

  function archivar() {
    Alert.alert(
      "Archivar a esta persona",
      "Sale de las listas y pierde el acceso a la app. La cuenta no se borra: su nombre firma los partes que cargó.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/api/mobile/personal/${id}`, { method: "DELETE" });
              router.back();
            } catch (e) {
              setError(mensajeDeError(e, "No pudimos archivarla"));
            }
          },
        },
      ]
    );
  }

  if (error && !ficha) {
    return (
      <View style={styles.centro}>
        <Text style={styles.apagado}>{error}</Text>
      </View>
    );
  }
  if (!ficha) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <PersonalForm
      inicial={{
        nombre: ficha.nombre,
        apellido: ficha.apellido,
        telefono: ficha.telefono,
        especialidad: ficha.especialidad,
        tipo: ficha.tipo,
        estado: ficha.estado,
      }}
      usuario={ficha.user?.usuario ?? null}
      etiqueta="Guardar cambios"
      onEliminar={archivar}
      onSubmit={async (valores) => {
        await apiRequest(`/api/mobile/personal/${id}`, {
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
