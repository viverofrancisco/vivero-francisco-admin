import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { UsuarioForm } from "@/components/UsuarioForm";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { UsuarioDelEquipo } from "@/lib/types";
import { tema } from "@/lib/tema";

/** Editar una cuenta del equipo: el formulario del alta, cargado. */
export default function UsuarioEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioDelEquipo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<UsuarioDelEquipo>(`/api/mobile/users/${id}`)
      .then(setUsuario)
      .catch((e) => setError(mensajeDeError(e, "No pudimos cargar el usuario")));
  }, [id]);

  if (!usuario) {
    return (
      <View style={styles.flex}>
        <EncabezadoDeFormulario
          titulo="Editar usuario"
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
    <UsuarioForm
      inicial={{
        name: usuario.name ?? "",
        apellido: usuario.apellido,
        email: usuario.email ?? "",
      }}
      titulo={[usuario.name, usuario.apellido].filter(Boolean).join(" ") || "Usuario"}
      accion="Guardar"
      onCancelar={() => router.back()}
      onSubmit={async (valores) => {
        await apiRequest(`/api/mobile/users/${id}`, { method: "PUT", body: valores });
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
