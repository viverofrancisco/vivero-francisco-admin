import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GrupoForm } from "@/components/GrupoForm";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { GrupoConMiembros } from "@/lib/types";
import { tema } from "@/lib/tema";

export default function GrupoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [grupo, setGrupo] = useState<GrupoConMiembros | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<GrupoConMiembros>(`/api/mobile/grupos/${id}`)
      .then(setGrupo)
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar el grupo")));
  }, [id]);

  function archivar() {
    Alert.alert(
      `Archivar ${grupo?.nombre ?? "el grupo"}`,
      "Deja de ofrecerse al agendar. Las visitas que salieron con él lo siguen nombrando.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/api/mobile/grupos/${id}`, { method: "DELETE" });
              router.back();
            } catch (e) {
              setError(mensajeDeError(e, "No pudimos archivarlo"));
            }
          },
        },
      ]
    );
  }

  // Sin barra nativa, el encabezado del formulario es el único; mientras
  // carga va igual, apagado, para que la pantalla no salte al llegar.
  if (!grupo) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFormulario
          titulo="Grupo"
          accion="Guardar"
          onAccion={() => {}}
          onCancelar={() => router.back()}
          deshabilitado
        />
        <View style={styles.centro}>
          {error ? (
            <Text style={styles.apagado}>{error}</Text>
          ) : (
            <ActivityIndicator size="large" />
          )}
        </View>
      </View>
    );
  }

  return (
    <GrupoForm
      inicial={{
        nombre: grupo.nombre,
        descripcion: grupo.descripcion,
        miembrosIds: grupo.miembros.map((m) => m.personal.id),
      }}
      titulo={grupo.nombre}
      accion="Guardar"
      onCancelar={() => router.back()}
      onEliminar={archivar}
      onSubmit={async (valores) => {
        await apiRequest(`/api/mobile/grupos/${id}`, {
          method: "PUT",
          body: valores,
        });
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  apagado: { color: tema.texto3, textAlign: "center" },
});
