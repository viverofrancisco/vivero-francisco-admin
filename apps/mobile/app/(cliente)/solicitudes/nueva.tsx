import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { HelperText, Text, TextInput } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiRequest, mensajeDeError } from "@/lib/api";
import type { ClienteProfileResponse } from "@/lib/types";
import { EncabezadoDeFormulario } from "@/components/ui/EncabezadoDeFormulario";
import { tema } from "@/lib/tema";

/**
 * Pedirle algo al vivero: una visita, una cotización, lo que haga falta, en
 * palabras de quien lo pide. Les llega a los administradores en el momento.
 *
 * Desde la ficha de un producto llega con ese producto puesto. La dirección se
 * pregunta solo a quien todavía no tiene una propiedad cargada: a los demás ya
 * se los conoce, y si es otra casa lo dicen en el mensaje.
 */
export default function NuevaSolicitudScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productoId?: string; producto?: string }>();
  const [mensaje, setMensaje] = useState("");
  const [direccion, setDireccion] = useState("");
  const [sinPropiedad, setSinPropiedad] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<ClienteProfileResponse>("/api/mobile/clientes/me")
      .then((r) => setSinPropiedad(r.cliente.propiedades.length === 0))
      .catch(() => {});
  }, []);

  async function enviar() {
    setError(null);
    setEnviando(true);
    try {
      await apiRequest("/api/mobile/solicitudes", {
        method: "POST",
        body: {
          mensaje: mensaje.trim(),
          productoId: params.productoId || undefined,
          direccion: direccion.trim() || undefined,
        },
      });
      Alert.alert(
        "Recibimos tu solicitud",
        "Te contactaremos pronto por teléfono o correo."
      );
      router.back();
    } catch (e) {
      setError(mensajeDeError(e, "No pudimos enviar tu solicitud"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.pantalla}>
      <EncabezadoDeFormulario
        titulo={params.productoId ? "Cotización" : "Solicitar visita"}
        accion="Enviar"
        onAccion={enviar}
        onCancelar={() => router.back()}
        cargando={enviando}
        deshabilitado={mensaje.trim().length === 0}
      />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.cuerpo} keyboardShouldPersistTaps="handled">
          {params.producto ? (
            <View style={styles.producto}>
              <Ionicons name="pricetag-outline" size={18} color={tema.verde700} />
              <Text style={styles.productoTexto} numberOfLines={2}>
                {params.producto}
              </Text>
            </View>
          ) : null}

          <TextInput
            mode="outlined"
            label={params.productoId ? "¿Qué necesitas?" : "¿Qué necesitas que hagamos?"}
            placeholder={
              params.productoId
                ? "Cantidad, medidas, cuándo lo necesitas…"
                : "Mantenimiento del jardín, poda, diseño…"
            }
            value={mensaje}
            onChangeText={setMensaje}
            multiline
            style={styles.mensaje}
            autoFocus
          />

          {sinPropiedad ? (
            <TextInput
              mode="outlined"
              label="Dirección (opcional)"
              placeholder="Urbanización, calle, número de casa"
              value={direccion}
              onChangeText={setDireccion}
              style={styles.input}
            />
          ) : null}

          <Text style={styles.nota}>
            Te contactaremos por teléfono o correo para coordinar.
          </Text>

          {error ? (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  cuerpo: { padding: 16, gap: 12 },
  producto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.verde50,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  productoTexto: { color: tema.verde700, fontWeight: "600", flexShrink: 1 },
  mensaje: { minHeight: 140 },
  input: {},
  nota: { color: tema.texto3, fontSize: 13, paddingHorizontal: 4 },
});
