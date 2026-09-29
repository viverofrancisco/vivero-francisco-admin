import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { PersonalForm } from "@/components/PersonalForm";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { PersonalFicha } from "@/lib/types";
import { tema } from "@/lib/tema";

/**
 * Editar la ficha de alguien: el mismo formulario del alta, cargado. Se llega
 * desde *Editar* en el ⋯ de la ficha, que ahora es de solo lectura, como la
 * del cliente y como la del portal.
 */
export default function PersonalEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ficha, setFicha] = useState<PersonalFicha | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<PersonalFicha>(`/api/mobile/personal/${id}`)
      .then(setFicha)
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar la ficha")));
  }, [id]);

  if (!ficha) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFormulario
          titulo="Editar personal"
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
      titulo={`${ficha.nombre} ${ficha.apellido ?? ""}`.trim()}
      accion="Guardar"
      onCancelar={() => router.back()}
      onSubmit={async (valores) => {
        await apiRequest(`/api/mobile/personal/${id}`, { method: "PUT", body: valores });
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
